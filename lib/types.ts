// 도메인 타입. mock 단계에서 정의하고, 실데이터(DART) 연동 시 동일 인터페이스를 재사용한다.

/** 시장 구분 */
export type Market = "KOSPI" | "KOSDAQ";

/** 종목 마스터의 한 항목 (검색·등록 대상) */
export interface Stock {
  /** 6자리 종목코드 (예: "005930") */
  code: string;
  /** 종목명 (예: "삼성전자") */
  name: string;
  market: Market;
  /** 주요 종목 유니버스(KOSPI200 등) 포함 여부 — 배치 요약 대상 표시용 */
  inCoreUniverse: boolean;
}

/** 공시 원문에서 뽑은 정형 항목 (구조화 발췌) */
export interface StructuredField {
  label: string;
  value: string;
  /** 강조 표시 여부 (예: 핵심 금액) */
  emphasize?: boolean;
}

/** 하나의 공시와 그 요약 */
export interface Disclosure {
  /** 접수번호 등 고유 식별자 */
  id: string;
  stockCode: string;
  stockName: string;
  /** 공시유형 라벨 (예: "실적", "공급계약") */
  type: string;
  /** 공시 제목 (원문 표기) */
  title: string;
  /**
   * 현재 시각 기준 몇 시간 전에 접수됐는지 (mock 전용).
   * 실데이터 연동 시 이 필드 대신 실제 접수 일시(submittedAt)를 사용한다.
   */
  hoursAgo: number;
  /** 원문 링크 (DART 등) */
  sourceUrl: string;
  /** 구조화 발췌 항목 */
  structured: StructuredField[];
  /** AI 요약 — 사실 중립 서술 3줄 (mock 단계에선 더미 텍스트) */
  aiSummary: string[];
}

/** 조회 기간 필터 */
export type Period = "today" | "week" | "month";

/** 화면 보기 방식 */
export type ViewMode = "feed" | "byStock";
