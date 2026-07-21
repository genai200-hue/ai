/**
 * OpenDART API 클라이언트 — 서버 전용.
 *
 * 인증키(crtfc_key)는 서버 환경변수 OPENDART_API_KEY 에서만 읽는다.
 * 절대 클라이언트로 노출하지 않는다(CORS·키 보안 때문에 브라우저 직접 호출 불가).
 * ADR-0001: 공시는 DART 단일 출처.
 *
 * 이 모듈은 서버(Route Handler)에서만 import 한다. OPENDART_API_KEY 는
 * NEXT_PUBLIC_ 접두사가 없으므로 클라이언트 번들에 포함되지 않는다.
 */

const BASE = "https://opendart.fss.or.kr/api";

/** DART 공시검색(list.json) 원본 항목 */
export interface DartListItem {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string; // Y=유가증권 K=코스닥 N=코넥스 E=기타
  report_nm: string;
  rcept_no: string; // 접수번호 = 공시 고유 식별자
  flr_nm: string; // 제출인
  rcept_dt: string; // YYYYMMDD
  rm: string;
}

/** 자기주식취득결정(tsstkAqDecsn) 주요 필드 */
export interface DartTreasuryAcq {
  rcept_no: string;
  aqpln_prc_ostk?: string; // 취득예정금액(보통주, 원)
  aqpln_prc_estk?: string; // 취득예정금액(기타주, 원)
  aqexpd_bgd?: string; // 취득예상기간 시작
  aqexpd_edd?: string; // 취득예상기간 종료
  aq_mth?: string; // 취득방법
  aq_pp?: string; // 취득목적
}

/** 유상증자결정(piicDecsn) 주요 필드 */
export interface DartRightsIssue {
  rcept_no: string;
  nstk_ostk_cnt?: string; // 신주 보통주식수
  fdpp_fclt?: string; // 자금조달목적 - 시설자금
  fdpp_op?: string; // 자금조달목적 - 운영자금
  ic_mthn?: string; // 증자방식
  [k: string]: string | undefined;
}

interface DartEnvelope<T> {
  status: string;
  message: string;
  list?: T[];
}

function apiKey(): string {
  const k = process.env.OPENDART_API_KEY;
  if (!k) {
    throw new Error(
      "OPENDART_API_KEY 가 설정되지 않았습니다. .env.local 에 키를 넣어주세요."
    );
  }
  return k;
}

async function dartGet<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("crtfc_key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // 공시는 자주 바뀌지 않으므로 짧게 캐시(서버 측). 실시간성이 필요하면 조정.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`DART ${endpoint} HTTP ${res.status}`);
  }
  const data = (await res.json()) as DartEnvelope<T>;

  if (data.status === "000") return data.list ?? [];
  if (data.status === "013") return []; // 조회된 데이터 없음 → 빈 배열
  // 020: 사용한도 초과, 100/101: 파라미터/키 오류 등
  throw new Error(`DART ${endpoint} status=${data.status} ${data.message}`);
}

/** 특정 기업의 기간 내 공시 목록 (최신 페이지 기준 최대 100건) */
export function fetchDisclosureList(
  corpCode: string,
  bgnDe: string,
  endDe: string
): Promise<DartListItem[]> {
  return dartGet<DartListItem>("list.json", {
    corp_code: corpCode,
    bgn_de: bgnDe,
    end_de: endDe,
    page_no: "1",
    page_count: "100",
  });
}

/** 자기주식취득결정 정형 정보 (기간 조회) */
export function fetchTreasuryAcq(
  corpCode: string,
  bgnDe: string,
  endDe: string
): Promise<DartTreasuryAcq[]> {
  return dartGet<DartTreasuryAcq>("tsstkAqDecsn.json", {
    corp_code: corpCode,
    bgn_de: bgnDe,
    end_de: endDe,
  });
}

/** 유상증자결정 정형 정보 (기간 조회) */
export function fetchRightsIssue(
  corpCode: string,
  bgnDe: string,
  endDe: string
): Promise<DartRightsIssue[]> {
  return dartGet<DartRightsIssue>("piicDecsn.json", {
    corp_code: corpCode,
    bgn_de: bgnDe,
    end_de: endDe,
  });
}
