/**
 * lib/dart/enrich.ts 순수 로직 단위 테스트 (네트워크·환경변수 불필요).
 *
 * 검증 대상: dartUrl, isMaterialReport, classifyType, rceptDtToMs, toDisclosure.
 * non-export(formatWon/josa/buildStructured/buildSummary/cleanTitle)은
 * toDisclosure 결과를 통해 간접 검증한다.
 *
 * 실행: node --import tsx --test test/dart-enrich.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dartUrl,
  isMaterialReport,
  classifyType,
  rceptDtToMs,
  toDisclosure,
} from "@/lib/dart/enrich";
import type { DartListItem } from "@/lib/dart/client";

/** 테스트용 DartListItem 기본값 (필드는 개별 케이스에서 덮어씀) */
function makeItem(overrides: Partial<DartListItem> = {}): DartListItem {
  return {
    corp_code: "00126380",
    corp_name: "삼성전자",
    stock_code: "005930",
    corp_cls: "Y",
    report_nm: "주요사항보고서(자기주식취득결정)",
    rcept_no: "20260708000011",
    flr_nm: "삼성전자",
    rcept_dt: "20260708",
    rm: "",
    ...overrides,
  };
}

/** 투자권유·전망성 어휘(ADR-0003 금지). 사실 서술에는 등장하면 안 됨 */
const FORBIDDEN_WORDS = ["전망", "예상돼", "추천", "목표주가", "매수", "매도"];

function assertNoForbidden(lines: string[]) {
  for (const line of lines) {
    for (const w of FORBIDDEN_WORDS) {
      assert.ok(
        !line.includes(w),
        `요약에 금지어 '${w}' 가 포함됨: "${line}"`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// dartUrl
// ---------------------------------------------------------------------------
test("dartUrl — 접수번호로 표준 뷰어 URL 생성", () => {
  assert.equal(
    dartUrl("20260720000001"),
    "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260720000001"
  );
});

// ---------------------------------------------------------------------------
// isMaterialReport
// ---------------------------------------------------------------------------
test("isMaterialReport — 노이즈성 정기 지분신고는 제외(false)", () => {
  assert.equal(
    isMaterialReport("임원ㆍ주요주주특정증권등소유상황보고서"),
    false
  );
  assert.equal(isMaterialReport("최대주주등소유주식변동신고서"), false);
});

test("isMaterialReport — 실적·공급계약·자기주식은 주요 공시(true)", () => {
  assert.equal(
    isMaterialReport("연결재무제표 기준 영업(잠정)실적(공정공시)"),
    true
  );
  assert.equal(isMaterialReport("단일판매ㆍ공급계약체결"), true);
  assert.equal(isMaterialReport("주요사항보고서(자기주식취득결정)"), true);
});

// ---------------------------------------------------------------------------
// classifyType — 각 분기
// ---------------------------------------------------------------------------
test("classifyType — 주요 유형별 분기", () => {
  assert.equal(
    classifyType("연결재무제표 기준 영업(잠정)실적(공정공시)"),
    "실적"
  );
  assert.equal(classifyType("잠정실적(공정공시)"), "실적");
  assert.equal(classifyType("단일판매ㆍ공급계약체결"), "공급계약");
  assert.equal(classifyType("공급계약체결"), "공급계약");
  assert.equal(classifyType("주요사항보고서(자기주식취득결정)"), "자기주식");
  assert.equal(classifyType("주요사항보고서(유상증자결정)"), "유상증자");
  assert.equal(classifyType("주요사항보고서(무상증자결정)"), "무상증자");
  assert.equal(classifyType("현금ㆍ현물배당결정"), "배당");
  assert.equal(classifyType("소송등의제기ㆍ신청(일정금액이상의청구)"), "소송");
  assert.equal(classifyType("회사합병결정"), "합병·분할");
  assert.equal(classifyType("회사분할결정"), "합병·분할");
  assert.equal(classifyType("감자결정"), "감자");
  assert.equal(classifyType("전환사채권발행결정"), "사채발행");
  assert.equal(classifyType("신주인수권부사채권발행결정"), "사채발행");
  assert.equal(classifyType("교환사채권발행결정"), "사채발행");
  assert.equal(classifyType("주식등의대량보유상황보고서(일반)"), "지분공시");
  assert.equal(classifyType("주요주주변경"), "지분공시");
  assert.equal(classifyType("기업설명회(IR)개최(안내공시)"), "IR");
  assert.equal(classifyType("기업설명회개최(안내공시)"), "IR");
  assert.equal(classifyType("현물출자정정신고서"), "기타");
});

test("classifyType — 오분류 회귀 케이스", () => {
  // '증권발행실적보고서'는 발행결과 보고서이지 영업(잠정)실적이 아님 → 기타
  assert.equal(classifyType("증권발행실적보고서"), "기타");
  // '결정'이 없는 유상증자 발행결과(자율공시)는 유상증자로 분류하지 않음 → 기타
  assert.equal(
    classifyType("유상증자또는주식관련사채등의발행결과(자율공시)"),
    "기타"
  );
  // 무상증자도 '결정'이 있어야 무상증자. 없으면 기타
  assert.equal(classifyType("무상증자"), "기타");
});

// ---------------------------------------------------------------------------
// rceptDtToMs
// ---------------------------------------------------------------------------
test("rceptDtToMs — YYYYMMDD를 로컬 자정 epoch ms로 변환(월 0-index)", () => {
  // new Date(2026, 6, 8) = 2026년 7월 8일 로컬 자정
  assert.equal(rceptDtToMs("20260708"), new Date(2026, 6, 8).getTime());
  assert.equal(rceptDtToMs("20260101"), new Date(2026, 0, 1).getTime());
  assert.equal(rceptDtToMs("20251231"), new Date(2025, 11, 31).getTime());
});

// ---------------------------------------------------------------------------
// toDisclosure — 자기주식 정형 결합
// ---------------------------------------------------------------------------
test("toDisclosure — 자기주식 정형 수치 결합 + 필드/요약 검증", () => {
  const item = makeItem({
    report_nm: "주요사항보고서(자기주식취득결정)   ", // 우측 패딩 공백
    rcept_no: "20260708000011",
    rcept_dt: "20260708",
  });
  const d = toDisclosure(item, {
    treasury: {
      rcept_no: "20260708000011",
      aqpln_prc_ostk: "3,509,995,276,400",
      aq_mth: "유가증권시장을 통한 장내 매수",
      aqexpd_bgd: "2026년 07월 09일",
      aqexpd_edd: "2026년 10월 08일",
      aq_pp: "주주가치 제고",
    },
  });

  // 스칼라 필드
  assert.equal(d.id, "20260708000011");
  assert.equal(d.stockCode, "005930");
  assert.equal(d.stockName, "삼성전자");
  assert.equal(d.type, "자기주식");
  assert.equal(d.title, "주요사항보고서(자기주식취득결정)"); // 공백 정리(cleanTitle)
  assert.equal(d.hoursAgo, 0);
  assert.equal(d.submittedMs, new Date(2026, 6, 8).getTime());
  assert.equal(
    d.sourceUrl,
    "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260708000011"
  );

  // 강조필드 = 취득예정금액, 천단위 콤마 + '원'(formatWon)
  const emph = d.structured.find((f) => f.emphasize);
  assert.ok(emph, "emphasize 필드가 있어야 함");
  assert.equal(emph!.label, "취득예정금액");
  assert.equal(emph!.value, "3,509,995,276,400원");

  // 취득방법/기간/목적 필드 존재
  const byLabel = (label: string) =>
    d.structured.find((f) => f.label === label);
  assert.equal(byLabel("취득방법")!.value, "유가증권시장을 통한 장내 매수");
  assert.equal(
    byLabel("취득예상기간")!.value,
    "2026년 07월 09일 ~ 2026년 10월 08일"
  );
  assert.equal(byLabel("취득목적")!.value, "주주가치 제고");

  // 요약 3줄, 마지막 줄에 금액
  assert.equal(d.aiSummary.length, 3);
  assert.match(d.aiSummary[0], /삼성전자가 '주요사항보고서\(자기주식취득결정\)'/);
  assert.match(d.aiSummary[2], /3,509,995,276,400원/);
});

// ---------------------------------------------------------------------------
// toDisclosure — 유상증자 정형 결합
// ---------------------------------------------------------------------------
test("toDisclosure — 유상증자 정형 수치 결합 + 요약 마지막 줄", () => {
  const item = makeItem({
    corp_name: "카카오",
    stock_code: "035720",
    report_nm: "주요사항보고서(유상증자결정)",
    rcept_no: "20260710000022",
    rcept_dt: "20260710",
    flr_nm: "카카오",
  });
  const d = toDisclosure(item, {
    rights: {
      rcept_no: "20260710000022",
      ic_mthn: "주주배정후 실권주 일반공모",
      nstk_ostk_cnt: "10,000,000",
      fdpp_fclt: "500,000,000,000",
      fdpp_op: "300,000,000,000",
    },
  });

  assert.equal(d.type, "유상증자");

  const byLabel = (label: string) =>
    d.structured.find((f) => f.label === label);
  assert.equal(byLabel("증자방식")!.value, "주주배정후 실권주 일반공모");

  // 신주 보통주식수: 강조 + '주' 접미
  const shares = byLabel("신주 보통주식수");
  assert.ok(shares);
  assert.equal(shares!.value, "10,000,000주");
  assert.equal(shares!.emphasize, true);

  // 자금조달(시설/운영) formatWon
  assert.equal(byLabel("자금조달(시설)")!.value, "500,000,000,000원");
  assert.equal(byLabel("자금조달(운영)")!.value, "300,000,000,000원");

  // 요약 마지막 줄(정형 항목 함께 공시)
  assert.equal(
    d.aiSummary[d.aiSummary.length - 1],
    "발행·자금 조달 내역이 정형 항목으로 함께 공시됐다."
  );
});

// ---------------------------------------------------------------------------
// toDisclosure — 정형 API 없는 유형(공급계약 등)
// ---------------------------------------------------------------------------
test("toDisclosure — 정형 API 없는 유형은 수치 없이 원문 안내(ADR-0003)", () => {
  const item = makeItem({
    corp_name: "삼성바이오로직스",
    stock_code: "207940",
    report_nm: "단일판매ㆍ공급계약체결",
    rcept_no: "20260718000032",
    rcept_dt: "20260718",
    flr_nm: "삼성바이오로직스",
  });
  const d = toDisclosure(item, {});

  assert.equal(d.type, "공급계약");
  // 수치를 지어내지 않음
  assert.equal(d.structured.length, 0);
  // 마지막 줄에 원문 확인 안내
  assert.match(
    d.aiSummary[d.aiSummary.length - 1],
    /구체적 수치와 세부 내용은 원문 공시에서 확인할 수 있다\./
  );
});

// ---------------------------------------------------------------------------
// formatWon 간접 — 0/빈값/'-'는 필드 미생성
// ---------------------------------------------------------------------------
test("formatWon 간접 — 취득예정금액이 '0'/''/'-'면 해당 필드 미생성", () => {
  for (const amt of ["0", "", "-"]) {
    const d = toDisclosure(makeItem(), {
      treasury: {
        rcept_no: "20260708000011",
        aqpln_prc_ostk: amt,
        aq_mth: "신탁계약을 통한 취득",
      },
    });
    assert.equal(
      d.structured.find((f) => f.label === "취득예정금액"),
      undefined,
      `금액 '${amt}'이면 취득예정금액 필드가 없어야 함`
    );
    // 금액이 없으면 emphasize 필드도 없어 요약 마지막 줄은 원문 안내로 폴백
    assert.match(
      d.aiSummary[d.aiSummary.length - 1],
      /원문 공시에서 확인할 수 있다\./
    );
  }
});

test("formatWon 간접 — 콤마 포함 문자열 정규화 후 재포맷", () => {
  const d = toDisclosure(makeItem(), {
    treasury: {
      rcept_no: "20260708000011",
      aqpln_prc_ostk: "3,509,995,276,400",
      aq_mth: "신탁계약을 통한 취득",
    },
  });
  const emph = d.structured.find((f) => f.emphasize);
  assert.equal(emph!.value, "3,509,995,276,400원");
});

// ---------------------------------------------------------------------------
// josa 간접 — 회사명 받침 유무로 조사 선택
// ---------------------------------------------------------------------------
test("josa 간접 — 받침 없는 이름은 '가', 받침 있는 이름은 '이'", () => {
  // 받침 없음: '카카오'(오) → "카카오가 '...'"
  const noJong = toDisclosure(
    makeItem({ corp_name: "카카오", report_nm: "단일판매ㆍ공급계약체결" }),
    {}
  );
  assert.match(noJong.aiSummary[0], /^카카오가 /);

  // 받침 있음: '현대건설'(설) → "현대건설이 '...'"
  const withJong = toDisclosure(
    makeItem({ corp_name: "현대건설", report_nm: "단일판매ㆍ공급계약체결" }),
    {}
  );
  assert.match(withJong.aiSummary[0], /^현대건설이 /);
});

test("josa 간접 — 비한글(영문)로 끝나는 이름은 받침 없음 처리('가')", () => {
  const d = toDisclosure(
    makeItem({ corp_name: "SK", report_nm: "단일판매ㆍ공급계약체결" }),
    {}
  );
  assert.match(d.aiSummary[0], /^SK가 /);
});

// ---------------------------------------------------------------------------
// cleanTitle 간접 — 앞뒤/중복 공백 정리
// ---------------------------------------------------------------------------
test("cleanTitle 간접 — title의 앞뒤/중복 공백이 정리됨", () => {
  const d = toDisclosure(
    makeItem({ report_nm: "  단일판매ㆍ공급계약   체결  " }),
    {}
  );
  assert.equal(d.title, "단일판매ㆍ공급계약 체결");
});

// ---------------------------------------------------------------------------
// ADR-0003 — 사실성 회귀: 요약에 전망·추천 어휘 없음
// ---------------------------------------------------------------------------
test("ADR-0003 회귀 — 요약 줄에 전망·추천 어휘가 없음", () => {
  // 자기주식(취득방법에 '매수'가 없는 신탁 케이스), 유상증자, 공급계약 모두 점검
  const treasury = toDisclosure(makeItem(), {
    treasury: {
      rcept_no: "20260708000011",
      aqpln_prc_ostk: "1,000,000,000",
      aq_mth: "신탁계약을 통한 취득",
      aq_pp: "주주가치 제고",
    },
  });
  const rights = toDisclosure(
    makeItem({ corp_name: "카카오", report_nm: "주요사항보고서(유상증자결정)" }),
    {
      rights: {
        rcept_no: "20260708000011",
        ic_mthn: "주주배정후 실권주 일반공모",
        nstk_ostk_cnt: "10,000,000",
        fdpp_op: "300,000,000,000",
      },
    }
  );
  const contract = toDisclosure(
    makeItem({ report_nm: "단일판매ㆍ공급계약체결" }),
    {}
  );

  assertNoForbidden(treasury.aiSummary);
  assertNoForbidden(rights.aiSummary);
  assertNoForbidden(contract.aiSummary);
});
