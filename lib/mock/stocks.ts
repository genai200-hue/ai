import type { Stock } from "@/lib/types";

/**
 * 주요 종목 유니버스 (KOSPI200 고정 리스트 일부).
 *
 * 등록 가능한 종목 전체는 `lib/dart/corp-index.json`(전체 상장사 색인)으로 검색·해석한다
 * (스펙 US-19). 이 목록은 그 위에 덧입히는 오버레이로, 배치 사전요약 대상·"유니버스"
 * 배지·시장(KOSPI/KOSDAQ) 라벨 표시에만 쓴다. inCoreUniverse=true 는 유니버스 포함을 뜻한다.
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
