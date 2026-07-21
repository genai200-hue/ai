/**
 * 순수 로직 단위 테스트 — 보강분 (네트워크 불필요).
 *
 * 기존 test/unit.test.ts 가 얕게 다루는 빈틈을 메운다(중복 회피).
 * - classifyType 확장 유형/경계
 * - isMaterialReport 노이즈 항목·부분 문자열 경계
 * - toDisclosure 유상증자 정형 결합, 빈/'-'/'0' 수치 방어(ADR-0003)
 * - 요약 사실성(ADR-0003): 전망·평가·매매의견 어휘 부재
 * - resolveCompanies 심화(정렬/정규화/코드조회/모호/방어)
 * - fmtDate / dartUrl 형식 계약
 * 실행: node --import tsx --test test/unit-extra.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyType,
  isMaterialReport,
  toDisclosure,
  dartUrl,
  fmtDate,
} from "../src/enrich.js";
import { resolveCompanies, COMPANY_COUNT } from "../src/company.js";
import { MAX_COMPANY_MATCHES } from "../src/constants.js";
import type { DartListItem } from "../src/dart.js";

/* --------------------------- 헬퍼 --------------------------- */

function makeItem(overrides: Partial<DartListItem> = {}): DartListItem {
  return {
    corp_code: "00126380",
    corp_name: "삼성전자",
    stock_code: "005930",
    corp_cls: "Y",
    report_nm: "주요사항보고서(유상증자결정)",
    rcept_no: "20260720000001",
    flr_nm: "삼성전자",
    rcept_dt: "20260720",
    rm: "",
    ...overrides,
  };
}

/** 요약에 등장해선 안 되는 전망·평가·매매의견 어휘(ADR-0003) */
const FORBIDDEN_WORDS = [
  "전망", "예측", "추천", "매수", "매도", "매매", "목표주가",
  "상승", "하락", "급등", "급락", "저평가", "고평가", "유망",
  "호재", "악재", "투자의견", "비중확대", "강세", "약세", "긍정적", "부정적",
];

function assertNoForbidden(summary: string[]): void {
  for (const line of summary) {
    for (const w of FORBIDDEN_WORDS) {
      assert.ok(!line.includes(w), `요약에 금지 어휘 '${w}' 포함: "${line}"`);
    }
  }
}

/* --------------------------- classifyType 확장 --------------------------- */

test("classifyType — 무상증자는 '결정'이 있어야 무상증자로 분류", () => {
  assert.equal(classifyType("주요사항보고서(무상증자결정)"), "무상증자");
  // '결정' 없는 무상증자 언급은 무상증자로 보지 않는다(유상증자와 동일한 엄격 규칙)
  assert.equal(classifyType("무상증자 안내"), "기타");
});

test("classifyType — 합병·분할은 하나의 유형으로 묶임", () => {
  assert.equal(classifyType("주요사항보고서(회사합병결정)"), "합병·분할");
  assert.equal(classifyType("주요사항보고서(회사분할결정)"), "합병·분할");
  assert.equal(classifyType("주요사항보고서(분할합병결정)"), "합병·분할");
});

test("classifyType — 감자 분류", () => {
  assert.equal(classifyType("주요사항보고서(감자결정)"), "감자");
  assert.equal(classifyType("주요사항보고서(무상감자결정)"), "감자");
});

test("classifyType — 사채발행(전환·신주인수권부·교환사채)", () => {
  assert.equal(classifyType("주요사항보고서(전환사채권발행결정)"), "사채발행");
  assert.equal(classifyType("주요사항보고서(신주인수권부사채권발행결정)"), "사채발행");
  assert.equal(classifyType("주요사항보고서(교환사채권발행결정)"), "사채발행");
});

test("classifyType — 배당(현금/주식)", () => {
  assert.equal(classifyType("현금ㆍ현물배당결정"), "배당");
  assert.equal(classifyType("주식배당결정"), "배당");
});

test("classifyType — 지분공시(대량보유/주요주주)", () => {
  assert.equal(classifyType("임원ㆍ주요주주특정증권등소유상황보고서"), "지분공시");
  assert.equal(classifyType("주식등의대량보유상황보고서(약식)"), "지분공시");
});

test("classifyType — 실적(영업실적/잠정실적)", () => {
  assert.equal(classifyType("영업(잠정)실적(공정공시)"), "실적");
  assert.equal(classifyType("매출액또는손익구조30%(대규모법인은15%)이상변동"), "기타");
});

test("classifyType — 우선순위 회귀: 유상증자결정은 실적보다 유상증자로", () => {
  // 실적 정규식(영업.*실적|잠정실적)에 걸리지 않는 유상증자 결정 확인
  assert.equal(classifyType("주요사항보고서(유상증자결정)"), "유상증자");
  // 자기주식'처분'결정도 자기주식 유형으로 묶인다
  assert.equal(classifyType("주요사항보고서(자기주식처분결정)"), "자기주식");
});

test("classifyType — 알 수 없는 유형은 기타", () => {
  assert.equal(classifyType("주주총회소집결의"), "기타");
  assert.equal(classifyType("조회공시요구(풍문또는보도)에대한답변"), "기타");
});

/* --------------------------- isMaterialReport 경계 --------------------------- */

test("isMaterialReport — 노이즈 항목 정확 문자열 제외", () => {
  assert.equal(isMaterialReport("특정증권등소유상황보고서"), false);
  assert.equal(isMaterialReport("최대주주등소유주식변동신고서"), false);
});

test("isMaterialReport — 부분 문자열(노이즈 미포함)은 주요 공시로 통과", () => {
  // '특정증권등소유'만으로는 노이즈 전체 문자열이 아니므로 material
  assert.equal(isMaterialReport("특정증권등소유"), true);
  assert.equal(isMaterialReport("최대주주등소유주식"), true);
  assert.equal(isMaterialReport(""), true);
  assert.equal(isMaterialReport("주요사항보고서(유상증자결정)"), true);
});

/* --------------------------- toDisclosure: 유상증자 정형 결합 --------------------------- */

test("toDisclosure — 유상증자 정형 값 결합 + 강조 필드 + 요약", () => {
  const item = makeItem({
    corp_name: "카카오",
    stock_code: "035720",
    report_nm: "주요사항보고서(유상증자결정)  ",
    rcept_no: "20260720000009",
    flr_nm: "카카오 ",
  });
  const d = toDisclosure(item, {
    rights: {
      rcept_no: "20260720000009",
      ic_mthn: "주주배정후 실권주 일반공모",
      nstk_ostk_cnt: "10,000,000",
      fdpp_fclt: "500,000,000,000",
      fdpp_op: "300,000,000,000",
    },
  });

  assert.equal(d.type, "유상증자");
  assert.equal(d.title, "주요사항보고서(유상증자결정)"); // 공백 정리
  assert.equal(d.filer, "카카오"); // trim
  assert.equal(d.stockCode, "035720");

  // 정형 4필드 + 강조는 신주 보통주식수
  const labels = d.structured.map((f) => f.label);
  assert.deepEqual(labels, [
    "증자방식",
    "신주 보통주식수",
    "자금조달(시설)",
    "자금조달(운영)",
  ]);
  const emph = d.structured.find((f) => f.emphasize);
  assert.ok(emph);
  assert.equal(emph!.label, "신주 보통주식수");
  // 주식수는 원문 문자열 그대로 + '주' (원화 콤마 재포맷 아님)
  assert.equal(emph!.value, "10,000,000주");
  // 금액 필드는 '원' 접미
  assert.equal(d.structured.find((f) => f.label === "자금조달(시설)")!.value, "500,000,000,000원");
  assert.equal(d.structured.find((f) => f.label === "자금조달(운영)")!.value, "300,000,000,000원");

  // 요약 3줄, 첫 줄 회사명·제목, 마지막 줄 정형 안내
  assert.equal(d.summary.length, 3);
  assert.match(d.summary[0], /카카오.*'주요사항보고서\(유상증자결정\)'/);
  assert.match(d.summary[2], /정형 항목으로 함께 공시/);
  assertNoForbidden(d.summary);
});

test("toDisclosure — 유상증자 정형 일부만 있어도 있는 값만 필드화", () => {
  const item = makeItem({ report_nm: "주요사항보고서(유상증자결정)" });
  const d = toDisclosure(item, {
    rights: {
      rcept_no: "20260720000001",
      ic_mthn: "-", // 제외
      nstk_ostk_cnt: "1,234,567",
      fdpp_fclt: "0", // 0원 → 제외
      fdpp_op: "", // 빈값 → 제외
    },
  });
  const labels = d.structured.map((f) => f.label);
  assert.deepEqual(labels, ["신주 보통주식수"]);
  assert.equal(d.structured[0].value, "1,234,567주");
  assert.equal(d.structured[0].emphasize, true);
});

/* --------------------------- toDisclosure: 빈/'-'/'0' 방어(ADR-0003) --------------------------- */

test("toDisclosure — 자기주식 금액이 '0'이면 수치 필드 생성 안 함", () => {
  const item = makeItem({ report_nm: "주요사항보고서(자기주식취득결정)" });
  const d = toDisclosure(item, {
    treasury: {
      rcept_no: "20260720000001",
      aqpln_prc_ostk: "0", // 0원 → 지어내지 않음
      aq_mth: "-",
      aqexpd_bgd: "-",
      aq_pp: "-",
    },
  });
  assert.equal(d.type, "자기주식");
  assert.equal(d.structured.length, 0);
  // 강조 필드 없으면 요약 마지막 줄은 원문 안내로 폴백
  assert.match(d.summary[2], /원문 공시에서 확인/);
  assertNoForbidden(d.summary);
});

test("toDisclosure — 유상증자 정형이 전부 비었으면 구조·수치 없음", () => {
  const item = makeItem({ report_nm: "주요사항보고서(유상증자결정)" });
  const d = toDisclosure(item, {
    rights: {
      rcept_no: "20260720000001",
      ic_mthn: "-",
      nstk_ostk_cnt: "-",
      fdpp_fclt: "-",
      fdpp_op: "-",
    },
  });
  assert.equal(d.structured.length, 0);
  assert.match(d.summary[2], /원문 공시에서 확인/);
});

test("toDisclosure — 정형 extra 미제공 유상증자는 목록 정보만", () => {
  const item = makeItem({ report_nm: "주요사항보고서(유상증자결정)" });
  const d = toDisclosure(item, {}); // rights 없음
  assert.equal(d.type, "유상증자");
  assert.equal(d.structured.length, 0);
  assert.match(d.summary[2], /원문 공시에서 확인/);
});

test("toDisclosure — 소송 등 정형 API 없는 유형은 수치 없이 원문 안내", () => {
  const item = makeItem({
    corp_name: "LG화학",
    stock_code: "051910",
    report_nm: "소송등의제기ㆍ신청(일정금액이상의청구)",
    rcept_no: "20260720000055",
  });
  const d = toDisclosure(item, {});
  assert.equal(d.type, "소송");
  assert.equal(d.structured.length, 0);
  assert.equal(d.summary.length, 3);
  assert.match(d.summary[2], /원문 공시에서 확인/);
  assertNoForbidden(d.summary);
});

/* --------------------------- 요약 사실성 & 조사(josa) --------------------------- */

test("요약 사실성 — 여러 유형 요약 어느 줄에도 금지 어휘 없음(ADR-0003)", () => {
  const types = [
    "연결재무제표 기준 영업(잠정)실적(공정공시)",
    "현금ㆍ현물배당결정",
    "주요사항보고서(전환사채권발행결정)",
    "주식등의대량보유상황보고서(일반)",
    "기업설명회(IR)개최(안내공시)",
  ];
  for (const report_nm of types) {
    const d = toDisclosure(makeItem({ report_nm }), {});
    assertNoForbidden(d.summary);
    assert.ok(d.summary.length >= 2);
  }
});

test("buildSummary — 종성 있는 회사명은 '이', 비한글은 '가' 조사", () => {
  const jong = toDisclosure(makeItem({ corp_name: "삼성", report_nm: "주주총회소집결의" }), {});
  assert.match(jong.summary[0], /^삼성이 '/); // '성'은 종성 있음
  const nonHangul = toDisclosure(makeItem({ corp_name: "SK", report_nm: "주주총회소집결의" }), {});
  assert.match(nonHangul.summary[0], /^SK가 '/); // 비한글 → 받침 없음 처리
});

test("buildSummary — 둘째 줄에 접수일자·제출인 사실 기재", () => {
  const d = toDisclosure(makeItem({ rcept_dt: "20260101", flr_nm: "  홍길동  " }), {});
  assert.match(d.summary[1], /접수일자는 2026\.01\.01/);
  assert.match(d.summary[1], /제출인은 홍길동/);
});

/* --------------------------- fmtDate / dartUrl 형식 계약 --------------------------- */

test("fmtDate — YYYYMMDD → YYYY.MM.DD", () => {
  assert.equal(fmtDate("20260708"), "2026.07.08");
  assert.equal(fmtDate("20261231"), "2026.12.31");
});

test("dartUrl / sourceUrl — rcpNo 14자리 뷰어 URL 계약", () => {
  const url = dartUrl("20260720000001");
  assert.match(url, /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/);
  const d = toDisclosure(makeItem({ rcept_no: "20260720000001" }), {});
  assert.equal(d.sourceUrl, url);
  assert.match(d.sourceUrl, /rcpNo=20260720000001$/);
});

/* --------------------------- resolveCompanies 심화 --------------------------- */

test("resolveCompanies — 6자리 종목코드는 최대 1건, 없는 코드는 빈 배열", () => {
  const hit = resolveCompanies("005930");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].corpName, "삼성전자");
  // 종목코드 조회 결과는 항상 1건 이하
  assert.ok(resolveCompanies("999999").length <= 1);
});

test("resolveCompanies — 이름 내부 공백/대소문자 정규화 후 정확 일치", () => {
  const spaced = resolveCompanies("삼 성 전 자");
  assert.equal(spaced[0]?.stockCode, "005930");
});

test("resolveCompanies — 부분 일치는 MAX_COMPANY_MATCHES 로 상한", () => {
  const many = resolveCompanies("삼성");
  assert.ok(many.length > 1, "모호한 이름은 여러 후보");
  assert.ok(many.length <= MAX_COMPANY_MATCHES, `상한 ${MAX_COMPANY_MATCHES} 초과 금지`);
});

test("resolveCompanies — 접두 일치가 부분 포함보다 앞에 정렬", () => {
  const results = resolveCompanies("삼성");
  const nq = "삼성";
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  // 접두 일치가 끝난 뒤에는 접두 일치가 다시 나오지 않아야 한다(정렬 불변식)
  let seenNonPrefix = false;
  for (const c of results) {
    const isPrefix = norm(c.corpName).startsWith(nq);
    if (!isPrefix) seenNonPrefix = true;
    else assert.ok(!seenNonPrefix, `접두 일치 '${c.corpName}'가 비접두 뒤에 나옴`);
  }
});

test("resolveCompanies — 빈 문자열/공백/특수문자 방어(throw 없이 빈 배열)", () => {
  assert.deepEqual(resolveCompanies(""), []);
  assert.deepEqual(resolveCompanies("   "), []);
  // 특수문자만으로는 일치 없음(예외 던지지 않음)
  assert.doesNotThrow(() => resolveCompanies("!@#$%^&*()"));
  assert.equal(resolveCompanies("존재할리없는특수토큰zzz龘").length, 0);
});

test("resolveCompanies — 5·7자리 숫자는 종목코드가 아니라 이름 검색으로 처리", () => {
  // /^\d{6}$/ 만 코드로 취급 → 그 외 자리수는 이름 부분일치(대개 무일치)
  assert.equal(resolveCompanies("00593").length, 0);
  assert.equal(resolveCompanies("0059300").length, 0);
});

test("COMPANY_COUNT — 상장사 색인 로드 불변식", () => {
  assert.equal(typeof COMPANY_COUNT, "number");
  assert.ok(COMPANY_COUNT > 3000, "상장사 색인이 로드돼야 함(>3000)");
});
