/**
 * GET /api/disclosures 라우트 계약 테스트.
 *
 * 라우트의 핵심 책임은 (1) codes 6자리 정규식 필터, (2) period 검증·기본값,
 * (3) 정상 조회 시 {items} 형태 반환, (4) codes 0건이면 fetch 없이 즉시 반환이다.
 * 실제 네트워크는 globalThis.fetch 스텁으로 막고, 인증키는 테스트 전용 값으로 세팅한다.
 * 모든 테스트는 fetch·env 를 저장→복원해 서로 독립적으로 실행된다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { GET } from "@/app/api/disclosures/route";

/** 공급계약(정형 API 불필요) 1건짜리 정상 목록 봉투 — list.json 응답용 */
const SUPPLY_ENVELOPE = {
  status: "000",
  message: "정상",
  list: [
    {
      corp_code: "00126380",
      corp_name: "삼성전자",
      stock_code: "005930",
      corp_cls: "Y",
      report_nm: "단일판매ㆍ공급계약체결",
      rcept_no: "20260718000032",
      flr_nm: "삼성전자",
      rcept_dt: "20260718",
      rm: "",
    },
  ],
};

/**
 * fetch 스텁 설치. 호출된 URL 을 모두 기록하고, list.json 요청에는 주어진 봉투를,
 * 그 외(정형 API)에는 빈 목록을 돌려준다. 반환한 restore()로 반드시 원복한다.
 */
function installFetchStub(listEnvelope: unknown = SUPPLY_ENVELOPE) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("list.json")) {
      return { ok: true, json: async () => listEnvelope } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ status: "000", message: "정상", list: [] }),
    } as unknown as Response;
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

/** OPENDART_API_KEY 를 테스트 값으로 세팅. 반환한 restore()로 원복. */
function setApiKey(value: string | undefined) {
  const original = process.env.OPENDART_API_KEY;
  if (value === undefined) delete process.env.OPENDART_API_KEY;
  else process.env.OPENDART_API_KEY = value;
  return {
    restore() {
      if (original === undefined) delete process.env.OPENDART_API_KEY;
      else process.env.OPENDART_API_KEY = original;
    },
  };
}

function makeReq(query: string): Request {
  return new Request(`https://example.test/api/disclosures${query}`);
}

/** YYYYMMDD → Date(로컬 자정) */
function parseYmd(s: string): Date {
  return new Date(
    Number(s.slice(0, 4)),
    Number(s.slice(4, 6)) - 1,
    Number(s.slice(6, 8))
  );
}

/** 두 YYYYMMDD 사이 일수 차 */
function dayDiff(bgn: string, end: string): number {
  return Math.round(
    (parseYmd(end).getTime() - parseYmd(bgn).getTime()) / 86_400_000
  );
}

test("codes 정규식 필터 — 6자리 숫자만 통과하고 유효 코드만 조회한다", async () => {
  const key = setApiKey("TESTKEY");
  const fx = installFetchStub();
  try {
    // abc(문자), 12345(5자리)는 걸러지고 005930만 통과해야 한다
    const res = await GET(makeReq("?codes=abc,12345,005930"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { items: unknown[] };
    assert.ok(Array.isArray(body.items));
    // 유효 코드 1건 → list.json 1회 호출, corp_code=005930의 매핑값 포함
    const listCalls = fx.calls.filter((u) => u.includes("list.json"));
    assert.equal(listCalls.length, 1);
    assert.ok(
      listCalls[0].includes("corp_code=00126380"),
      "005930의 corp_code로 조회해야 함"
    );
  } finally {
    fx.restore();
    key.restore();
  }
});

test("codes 공백 트리밍 — 앞뒤 공백을 제거한 뒤 6자리면 통과한다", async () => {
  const key = setApiKey("TESTKEY");
  const fx = installFetchStub();
  try {
    const res = await GET(makeReq("?codes=%20005930%20,%20000660%20"));
    assert.equal(res.status, 200);
    const listCalls = fx.calls.filter((u) => u.includes("list.json"));
    // 두 코드 모두 트리밍 후 유효 → 각각 조회
    assert.equal(listCalls.length, 2);
  } finally {
    fx.restore();
    key.restore();
  }
});

test("codes 전부 무효/누락 — fetch 호출 없이 즉시 {items:[]} (200)", async () => {
  const key = setApiKey("TESTKEY");
  const fx = installFetchStub();
  try {
    // 전부 무효
    const res1 = await GET(makeReq("?codes=abc,12345,%20,xyz"));
    assert.equal(res1.status, 200);
    const body1 = (await res1.json()) as { items: unknown[] };
    assert.deepEqual(body1.items, []);

    // codes 파라미터 누락
    const res2 = await GET(makeReq(""));
    assert.equal(res2.status, 200);
    const body2 = (await res2.json()) as { items: unknown[] };
    assert.deepEqual(body2.items, []);

    // 최적화: 유효 코드 0건이면 getDisclosures/fetch 진입 자체가 없어야 함
    assert.equal(fx.calls.length, 0, "fetch 가 한 번도 호출되면 안 됨");
  } finally {
    fx.restore();
    key.restore();
  }
});

test("정상 조회 — 유효 codes + 스텁 fetch → {items:[...]} 형태 (200)", async () => {
  const key = setApiKey("TESTKEY");
  const fx = installFetchStub();
  try {
    const res = await GET(makeReq("?codes=005930&period=week"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      items: Array<{ id: string; type: string; stockCode: string }>;
    };
    assert.equal(body.items.length, 1);
    const d = body.items[0];
    assert.equal(d.id, "20260718000032");
    assert.equal(d.type, "공급계약");
    assert.equal(d.stockCode, "005930");
  } finally {
    fx.restore();
    key.restore();
  }
});

test("period 검증/기본값 — today는 시작=종료, week/month는 기간 차가 다르다", async () => {
  const key = setApiKey("TESTKEY");

  // today: bgn_de == end_de
  {
    const fx = installFetchStub();
    try {
      const res = await GET(makeReq("?codes=005930&period=today"));
      assert.equal(res.status, 200);
      const url = new URL(fx.calls.find((u) => u.includes("list.json"))!);
      const bgn = url.searchParams.get("bgn_de")!;
      const end = url.searchParams.get("end_de")!;
      assert.equal(dayDiff(bgn, end), 0, "today 는 하루");
    } finally {
      fx.restore();
    }
  }

  // week: 6일 차 (오늘-6 ~ 오늘)
  {
    const fx = installFetchStub();
    try {
      await GET(makeReq("?codes=005930&period=week"));
      const url = new URL(fx.calls.find((u) => u.includes("list.json"))!);
      assert.equal(
        dayDiff(url.searchParams.get("bgn_de")!, url.searchParams.get("end_de")!),
        6,
        "week 는 6일 차"
      );
    } finally {
      fx.restore();
    }
  }

  // month: 29일 차 (오늘-29 ~ 오늘)
  {
    const fx = installFetchStub();
    try {
      await GET(makeReq("?codes=005930&period=month"));
      const url = new URL(fx.calls.find((u) => u.includes("list.json"))!);
      assert.equal(
        dayDiff(url.searchParams.get("bgn_de")!, url.searchParams.get("end_de")!),
        29,
        "month 는 29일 차"
      );
    } finally {
      fx.restore();
    }
  }

  key.restore();
});

test("period 무효/누락 — week(6일)로 기본 처리되고 200을 반환한다", async () => {
  const key = setApiKey("TESTKEY");

  for (const q of ["?codes=005930&period=yearly", "?codes=005930"]) {
    const fx = installFetchStub();
    try {
      const res = await GET(makeReq(q));
      assert.equal(res.status, 200, `${q} → 200`);
      const url = new URL(fx.calls.find((u) => u.includes("list.json"))!);
      assert.equal(
        dayDiff(url.searchParams.get("bgn_de")!, url.searchParams.get("end_de")!),
        6,
        `${q} 는 week 기본값(6일)`
      );
    } finally {
      fx.restore();
    }
  }

  key.restore();
});

test("부분 성공 설계 — 인증키 미설정이어도 종목별 catch가 흡수해 200 {items:[]}", async () => {
  // 발견 사항: 라우트의 500 에러-매핑 브랜치는 getDisclosures 가 종목별로 예외를
  // 삼키므로(부분 성공) 유효 codes + 인증키 오류 경로에서는 도달하지 않는다.
  // 관찰 가능한 계약은 "200 + items:[]" 이며, 여기서 이를 회귀 고정한다.
  const key = setApiKey(undefined); // 키 제거 → client.apiKey()가 throw
  const fx = installFetchStub();
  try {
    const res = await GET(makeReq("?codes=005930&period=week"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { items: unknown[] };
    assert.deepEqual(body.items, []);
  } finally {
    fx.restore();
    key.restore();
  }
});
