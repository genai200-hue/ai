/**
 * 순수 로직 단위 테스트 (네트워크 불필요).
 * 실행: npm run test:unit
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyType, isMaterialReport, toDisclosure, dartUrl } from "../src/enrich.js";
import { resolveCompanies, COMPANY_COUNT } from "../src/company.js";
import type { DartListItem } from "../src/dart.js";

test("classifyType — 주요 유형 매핑", () => {
  assert.equal(classifyType("연결재무제표 기준 영업(잠정)실적(공정공시)"), "실적");
  assert.equal(classifyType("단일판매ㆍ공급계약체결"), "공급계약");
  assert.equal(classifyType("주요사항보고서(자기주식취득결정)"), "자기주식");
  assert.equal(classifyType("주요사항보고서(유상증자결정)"), "유상증자");
  assert.equal(classifyType("현금ㆍ현물배당결정"), "배당");
  assert.equal(classifyType("소송등의제기ㆍ신청(일정금액이상의청구)"), "소송");
  assert.equal(classifyType("기업설명회(IR)개최(안내공시)"), "IR");
  assert.equal(classifyType("주식등의대량보유상황보고서(일반)"), "지분공시");
});

test("classifyType — 오분류 회귀: 증권발행실적보고서는 실적이 아님", () => {
  assert.equal(classifyType("증권발행실적보고서"), "기타");
  // '결정'이 없는 유상증자 발행결과는 유상증자로 분류하지 않는다
  assert.equal(classifyType("유상증자또는주식관련사채등의발행결과(자율공시)"), "기타");
});

test("isMaterialReport — 노이즈성 정기 지분신고 제외", () => {
  assert.equal(isMaterialReport("임원ㆍ주요주주특정증권등소유상황보고서"), false);
  assert.equal(isMaterialReport("최대주주등소유주식변동신고서"), false);
  assert.equal(isMaterialReport("주요사항보고서(자기주식취득결정)"), true);
  assert.equal(isMaterialReport("단일판매ㆍ공급계약체결"), true);
});

test("dartUrl — 접수번호로 표준 뷰어 URL 생성", () => {
  assert.equal(
    dartUrl("20260720000001"),
    "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260720000001"
  );
});

test("toDisclosure — 자기주식 정형 수치 결합 + 사실 요약", () => {
  const item: DartListItem = {
    corp_code: "00126380",
    corp_name: "삼성전자",
    stock_code: "005930",
    corp_cls: "Y",
    report_nm: "주요사항보고서(자기주식취득결정)   ",
    rcept_no: "20260708000011",
    flr_nm: "삼성전자",
    rcept_dt: "20260708",
    rm: "",
  };
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

  assert.equal(d.type, "자기주식");
  assert.equal(d.title, "주요사항보고서(자기주식취득결정)"); // 공백 정리
  assert.equal(d.stockCode, "005930");
  // 강조 필드 = 취득예정금액, 천단위 콤마 + '원'
  const emph = d.structured.find((f) => f.emphasize);
  assert.ok(emph);
  assert.equal(emph!.label, "취득예정금액");
  assert.equal(emph!.value, "3,509,995,276,400원");
  // 요약은 3줄, 첫 줄에 회사명·제목, 마지막 줄에 금액
  assert.equal(d.summary.length, 3);
  assert.match(d.summary[0], /삼성전자가 '주요사항보고서\(자기주식취득결정\)'/);
  assert.match(d.summary[2], /3,509,995,276,400원/);
  assert.equal(d.sourceUrl, "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260708000011");
});

test("toDisclosure — 정형 API 없는 유형은 수치 없이 목록 정보 + 원문 안내", () => {
  const item: DartListItem = {
    corp_code: "00877059",
    corp_name: "삼성바이오로직스",
    stock_code: "207940",
    corp_cls: "Y",
    report_nm: "단일판매ㆍ공급계약체결",
    rcept_no: "20260718000032",
    flr_nm: "삼성바이오로직스",
    rcept_dt: "20260718",
    rm: "",
  };
  const d = toDisclosure(item, {});
  assert.equal(d.type, "공급계약");
  assert.equal(d.structured.length, 0); // 수치 지어내지 않음
  assert.match(d.summary[2], /원문 공시에서 확인/);
});

test("resolveCompanies — 정확 일치 / 종목코드 / 부분 일치 / 없음", () => {
  assert.ok(COMPANY_COUNT > 3000, "상장사 색인이 로드돼야 함");

  const exact = resolveCompanies("삼성전자");
  assert.equal(exact.length, 1);
  assert.equal(exact[0].stockCode, "005930");

  const byCode = resolveCompanies("005930");
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].corpName, "삼성전자");

  const bio = resolveCompanies("삼성바이오");
  assert.equal(bio[0].corpName, "삼성바이오로직스");

  const many = resolveCompanies("삼성");
  assert.ok(many.length > 1, "모호한 이름은 여러 후보 반환");

  const none = resolveCompanies("존재하지않는회사명zzz");
  assert.equal(none.length, 0);
});

test("resolveCompanies — 공백/대소문자 무시", () => {
  const a = resolveCompanies(" 삼성전자 ");
  assert.equal(a[0]?.stockCode, "005930");
});
