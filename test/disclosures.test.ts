/**
 * 데이터 제공자 seam(lib/disclosures.ts) 통합 테스트 — globalThis.fetch 스텁.
 *
 * seam → DART 클라이언트 → enrich 전 경로를 네트워크 없이 검증한다.
 * (CLAUDE.md: 이 seam이 주요 테스트 지점)
 * 실행: node --import tsx --test test/disclosures.test.ts
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { getDisclosures } from "@/lib/disclosures";
import type { DartListItem } from "@/lib/dart/client";

// 종목코드 → corp_code (corpCodes.ts 기준)
const CORP = {
  "005930": "00126380", // 삼성전자
  "000660": "00164779", // SK하이닉스
} as const;

const REAL_FETCH = globalThis.fetch;
const REAL_KEY = process.env.OPENDART_API_KEY;

/** DART 목록 항목 팩토리 */
function listItem(over: Partial<DartListItem>): DartListItem {
  return {
    corp_code: over.corp_code ?? "00126380",
    corp_name: over.corp_name ?? "삼성전자",
    stock_code: over.stock_code ?? "005930",
    corp_cls: "Y",
    report_nm: over.report_nm ?? "단일판매ㆍ공급계약체결",
    rcept_no: over.rcept_no ?? "20260710000001",
    flr_nm: over.flr_nm ?? "삼성전자",
    rcept_dt: over.rcept_dt ?? "20260710",
    rm: "",
  };
}

// ── 스텁 설정(테스트마다 교체) ──────────────────────────────────────────────
interface Cfg {
  list: Record<string, DartListItem[]>; // corp_code → 목록
  treasury: Record<string, Record<string, string>[]>;
  rights: Record<string, Record<string, string>[]>;
  throwListFor: Set<string>; // 이 corp_code의 list.json은 네트워크 오류
  throwTreasury: boolean; // tsstkAqDecsn.json은 status 오류로 throw
}
let cfg: Cfg;
let calls: { endpoint: string; corp: string; bgn: string; end: string }[];

function json(env: unknown, status = 200): Response {
  return new Response(JSON.stringify(env), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.OPENDART_API_KEY = "TESTKEY";
  cfg = { list: {}, treasury: {}, rights: {}, throwListFor: new Set(), throwTreasury: false };
  calls = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.split("/").pop()!;
    const corp = url.searchParams.get("corp_code") ?? "";
    calls.push({
      endpoint,
      corp,
      bgn: url.searchParams.get("bgn_de") ?? "",
      end: url.searchParams.get("end_de") ?? "",
    });
    if (endpoint === "list.json") {
      if (cfg.throwListFor.has(corp)) throw new Error("network down");
      return json({ status: "000", message: "정상", list: cfg.list[corp] ?? [] });
    }
    if (endpoint === "tsstkAqDecsn.json") {
      if (cfg.throwTreasury)
        return json({ status: "020", message: "사용한도 초과" }); // 클라이언트가 throw
      return json({ status: "000", message: "정상", list: cfg.treasury[corp] ?? [] });
    }
    if (endpoint === "piicDecsn.json") {
      return json({ status: "000", message: "정상", list: cfg.rights[corp] ?? [] });
    }
    return json({ status: "013", message: "없음" });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  if (REAL_KEY === undefined) delete process.env.OPENDART_API_KEY;
  else process.env.OPENDART_API_KEY = REAL_KEY;
});

function endpointsCalled(): string[] {
  return calls.map((c) => c.endpoint);
}

// ── 정렬 ────────────────────────────────────────────────────────────────────
test("여러 종목·여러 공시를 submittedMs 내림차순으로 정렬", async () => {
  cfg.list[CORP["005930"]] = [
    listItem({ rcept_no: "A710", rcept_dt: "20260710" }),
    listItem({ rcept_no: "A715", rcept_dt: "20260715" }),
  ];
  cfg.list[CORP["000660"]] = [
    listItem({
      corp_code: CORP["000660"],
      corp_name: "SK하이닉스",
      stock_code: "000660",
      rcept_no: "B712",
      rcept_dt: "20260712",
    }),
  ];
  const out = await getDisclosures(["005930", "000660"], "month");
  assert.deepEqual(
    out.map((d) => d.id),
    ["A715", "B712", "A710"]
  );
  // 내림차순 불변식 확인
  for (let i = 1; i < out.length; i++) {
    assert.ok((out[i - 1].submittedMs ?? 0) >= (out[i].submittedMs ?? 0));
  }
});

// ── 부분 성공/실패 격리 ─────────────────────────────────────────────────────
test("한 종목 fetch 실패해도 다른 종목 결과는 반환", async () => {
  cfg.throwListFor.add(CORP["005930"]); // 삼성전자 목록 조회 실패
  cfg.list[CORP["000660"]] = [
    listItem({
      corp_code: CORP["000660"],
      corp_name: "SK하이닉스",
      stock_code: "000660",
      rcept_no: "B1",
      rcept_dt: "20260712",
    }),
  ];
  const out = await getDisclosures(["005930", "000660"], "week");
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "B1");
  assert.equal(out[0].stockCode, "000660");
});

// ── 색인에 없는 코드 / 유니버스 밖 상장사 ────────────────────────────────────
test("상장사 색인에 없는 코드(미상장·오타)는 결과 0건이고 fetch를 호출하지 않음", async () => {
  const out = await getDisclosures(["999999"], "today");
  assert.deepEqual(out, []);
  assert.equal(calls.length, 0);
});

test("유효 코드와 섞여도 색인에 없는 코드는 fetch되지 않음", async () => {
  cfg.list[CORP["005930"]] = [listItem({ rcept_no: "A1" })];
  const out = await getDisclosures(["005930", "999999"], "today");
  assert.equal(out.length, 1);
  // list.json은 005930(=00126380)에 대해서만 호출됨
  const listCalls = calls.filter((c) => c.endpoint === "list.json");
  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0].corp, CORP["005930"]);
});

test("유니버스 밖 상장사(유한양행 000100)도 corp_code로 해석돼 fetch된다 (US-19 회귀)", async () => {
  // 20종목 고정 맵에는 없지만 전체 상장사 색인(corp-index.json)에는 있는 종목.
  // 색인 해석이 동작하면 000100 → 00145109 로 list.json 을 호출해야 한다.
  const YUHAN = "00145109";
  cfg.list[YUHAN] = [
    listItem({
      corp_code: YUHAN,
      corp_name: "유한양행",
      stock_code: "000100",
      rcept_no: "Y1",
    }),
  ];
  const out = await getDisclosures(["000100"], "today");
  assert.equal(out.length, 1);
  assert.equal(out[0].stockCode, "000100");
  const listCalls = calls.filter((c) => c.endpoint === "list.json");
  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0].corp, YUHAN);
});

// ── 노이즈 필터 ─────────────────────────────────────────────────────────────
test("특정증권등소유상황보고서는 결과에서 제외(isMaterialReport)", async () => {
  cfg.list[CORP["005930"]] = [
    listItem({ rcept_no: "NOISE", report_nm: "임원ㆍ주요주주특정증권등소유상황보고서" }),
    listItem({ rcept_no: "MAT", report_nm: "단일판매ㆍ공급계약체결" }),
  ];
  const out = await getDisclosures(["005930"], "month");
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "MAT");
});

// ── 정형 API 호출 최적화 ────────────────────────────────────────────────────
test("자기주식 유형이 없으면 tsstkAqDecsn.json을 호출하지 않음", async () => {
  cfg.list[CORP["005930"]] = [
    listItem({ rcept_no: "C1", report_nm: "단일판매ㆍ공급계약체결" }),
  ];
  await getDisclosures(["005930"], "month");
  assert.ok(!endpointsCalled().includes("tsstkAqDecsn.json"));
  assert.ok(!endpointsCalled().includes("piicDecsn.json"));
});

test("자기주식 유형이 있으면 호출하고 rcept_no로 정형 수치를 결합", async () => {
  cfg.list[CORP["005930"]] = [
    listItem({ rcept_no: "T1", report_nm: "주요사항보고서(자기주식취득결정)" }),
  ];
  cfg.treasury[CORP["005930"]] = [
    {
      rcept_no: "T1",
      aqpln_prc_ostk: "3,509,995,276,400",
      aq_mth: "유가증권시장을 통한 장내 매수",
    },
  ];
  const out = await getDisclosures(["005930"], "month");
  assert.ok(endpointsCalled().includes("tsstkAqDecsn.json"));
  assert.equal(out.length, 1);
  assert.equal(out[0].type, "자기주식");
  const emph = out[0].structured.find((f) => f.emphasize);
  assert.ok(emph, "취득예정금액 강조 필드가 있어야 함");
  assert.equal(emph!.value, "3,509,995,276,400원");
});

// ── 정형 API 실패 내성 ──────────────────────────────────────────────────────
test("목록 성공·정형 API 실패 시 그 공시는 수치 없이 반환", async () => {
  cfg.list[CORP["005930"]] = [
    listItem({ rcept_no: "T2", report_nm: "주요사항보고서(자기주식취득결정)" }),
  ];
  cfg.throwTreasury = true; // tsstkAqDecsn.json이 status 오류로 throw
  const out = await getDisclosures(["005930"], "month");
  assert.equal(out.length, 1);
  assert.equal(out[0].type, "자기주식");
  assert.equal(out[0].structured.length, 0); // 수치 결합 실패 → 빈 배열
});

// ── period → 날짜 범위 ──────────────────────────────────────────────────────
function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}${m}${day}`;
}

test("today — bgn_de=end_de=오늘(YYYYMMDD)", async () => {
  cfg.list[CORP["005930"]] = [listItem({ rcept_no: "A1" })];
  await getDisclosures(["005930"], "today");
  const c = calls.find((x) => x.endpoint === "list.json")!;
  const today = todayYmd();
  assert.equal(c.end, today);
  assert.equal(c.bgn, today);
});

test("week/month — end=오늘, bgn<end 이고 둘 다 8자리", async () => {
  cfg.list[CORP["005930"]] = [listItem({ rcept_no: "A1" })];
  const today = todayYmd();

  await getDisclosures(["005930"], "week");
  const wk = calls.find((x) => x.endpoint === "list.json")!;
  assert.equal(wk.end, today);
  assert.match(wk.bgn, /^\d{8}$/);
  assert.ok(wk.bgn < wk.end, "week 시작일은 오늘보다 과거여야 함");

  calls.length = 0;
  await getDisclosures(["005930"], "month");
  const mo = calls.find((x) => x.endpoint === "list.json")!;
  assert.equal(mo.end, today);
  assert.match(mo.bgn, /^\d{8}$/);
  assert.ok(mo.bgn < mo.end, "month 시작일은 오늘보다 과거여야 함");
  // month 범위가 week 범위보다 더 과거로 넓어야 함
  assert.ok(mo.bgn < wk.bgn, "month 시작일은 week 시작일보다 과거여야 함");
});
