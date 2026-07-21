import type { Stock } from "@/lib/types";

/**
 * 종목 마스터 (mock).
 * 실데이터 연동 시 DART 기업개황(corpCode) 기반 목록으로 교체한다.
 * inCoreUniverse=true 는 KOSPI200 고정 리스트(주요 종목 유니버스) 포함을 의미한다.
 */
export const STOCK_MASTER: Stock[] = [
  { code: "005930", name: "삼성전자", market: "KOSPI", inCoreUniverse: true },
  { code: "000660", name: "SK하이닉스", market: "KOSPI", inCoreUniverse: true },
  { code: "373220", name: "LG에너지솔루션", market: "KOSPI", inCoreUniverse: true },
  { code: "207940", name: "삼성바이오로직스", market: "KOSPI", inCoreUniverse: true },
  { code: "005380", name: "현대차", market: "KOSPI", inCoreUniverse: true },
  { code: "000270", name: "기아", market: "KOSPI", inCoreUniverse: true },
  { code: "005490", name: "POSCO홀딩스", market: "KOSPI", inCoreUniverse: true },
  { code: "051910", name: "LG화학", market: "KOSPI", inCoreUniverse: true },
  { code: "035420", name: "NAVER", market: "KOSPI", inCoreUniverse: true },
  { code: "035720", name: "카카오", market: "KOSPI", inCoreUniverse: true },
  { code: "068270", name: "셀트리온", market: "KOSPI", inCoreUniverse: true },
  { code: "105560", name: "KB금융", market: "KOSPI", inCoreUniverse: true },
  { code: "055550", name: "신한지주", market: "KOSPI", inCoreUniverse: true },
  { code: "012330", name: "현대모비스", market: "KOSPI", inCoreUniverse: true },
  { code: "015760", name: "한국전력", market: "KOSPI", inCoreUniverse: true },
  { code: "247540", name: "에코프로비엠", market: "KOSDAQ", inCoreUniverse: false },
  { code: "086520", name: "에코프로", market: "KOSDAQ", inCoreUniverse: false },
  { code: "091990", name: "셀트리온헬스케어", market: "KOSDAQ", inCoreUniverse: false },
  { code: "066970", name: "엘앤에프", market: "KOSDAQ", inCoreUniverse: false },
  { code: "196170", name: "알테오젠", market: "KOSDAQ", inCoreUniverse: false },
];

/** 기본 관심종목 시드 (첫 방문 시 화면이 비지 않도록) */
export const DEFAULT_WATCHLIST = ["005930", "000660", "035420", "247540"];

export function findStock(code: string): Stock | undefined {
  return STOCK_MASTER.find((s) => s.code === code);
}
