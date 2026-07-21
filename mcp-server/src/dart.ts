/**
 * OpenDART API 클라이언트 (서버 전용). 인증키는 OPENDART_API_KEY 환경변수에서만.
 */
import { DART_API_BASE, MAX_LIST_PAGES, LIST_PAGE_SIZE } from "./constants.js";

export interface DartListItem {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface DartTreasuryAcq {
  rcept_no: string;
  aqpln_prc_ostk?: string; // 취득예정금액(보통주, 원)
  aqexpd_bgd?: string; // 취득예상기간 시작
  aqexpd_edd?: string; // 취득예상기간 종료
  aq_mth?: string; // 취득방법
  aq_pp?: string; // 취득목적
}

export interface DartRightsIssue {
  rcept_no: string;
  nstk_ostk_cnt?: string; // 신주 보통주식수
  fdpp_fclt?: string; // 자금조달 - 시설
  fdpp_op?: string; // 자금조달 - 운영
  ic_mthn?: string; // 증자방식
  [k: string]: string | undefined;
}

interface DartEnvelope<T> {
  status: string;
  message: string;
  list?: T[];
  total_page?: number;
  page_no?: number;
}

export class DartError extends Error {
  constructor(
    message: string,
    public readonly status?: string
  ) {
    super(message);
    this.name = "DartError";
  }
}

function apiKey(): string {
  const k = process.env.OPENDART_API_KEY;
  if (!k) {
    throw new DartError(
      "OPENDART_API_KEY 환경변수가 설정되지 않았습니다. OpenDART 인증키를 설정하세요."
    );
  }
  return k;
}

async function dartRequest<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<DartEnvelope<T>> {
  const url = new URL(`${DART_API_BASE}/${endpoint}`);
  url.searchParams.set("crtfc_key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    throw new DartError(
      e instanceof Error && e.name === "AbortError"
        ? `DART 요청 시간 초과 (${endpoint})`
        : `DART 연결 실패 (${endpoint}): ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new DartError(`DART ${endpoint} HTTP ${res.status}`);
  const data = (await res.json()) as DartEnvelope<T>;

  if (data.status === "000") return data;
  if (data.status === "013") return { ...data, list: [] }; // 데이터 없음
  if (data.status === "020")
    throw new DartError("DART 사용 한도를 초과했습니다. 잠시 후 다시 시도하세요.", "020");
  if (data.status === "011" || data.status === "010")
    throw new DartError("DART 인증키가 유효하지 않거나 사용할 수 없습니다.", data.status);
  throw new DartError(`DART ${endpoint} 오류: ${data.status} ${data.message}`, data.status);
}

/** 단일 응답(정형) 엔드포인트용 */
async function dartList<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T[]> {
  return (await dartRequest<T>(endpoint, params)).list ?? [];
}

/**
 * 공시 목록 조회. 지분신고 노이즈가 최신 구간을 채워 주요 공시가 뒤 페이지로
 * 밀리므로 MAX_LIST_PAGES 까지 페이지네이션해 합친다.
 */
export async function fetchDisclosureList(
  corpCode: string,
  bgnDe: string,
  endDe: string
): Promise<DartListItem[]> {
  const acc: DartListItem[] = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const env = await dartRequest<DartListItem>("list.json", {
      corp_code: corpCode,
      bgn_de: bgnDe,
      end_de: endDe,
      page_no: String(page),
      page_count: String(LIST_PAGE_SIZE),
    });
    const batch = env.list ?? [];
    acc.push(...batch);
    const totalPage = env.total_page ?? 1;
    if (page >= totalPage || batch.length < LIST_PAGE_SIZE) break;
  }
  return acc;
}

export function fetchTreasuryAcq(
  corpCode: string,
  bgnDe: string,
  endDe: string
): Promise<DartTreasuryAcq[]> {
  return dartList<DartTreasuryAcq>("tsstkAqDecsn.json", {
    corp_code: corpCode,
    bgn_de: bgnDe,
    end_de: endDe,
  });
}

export function fetchRightsIssue(
  corpCode: string,
  bgnDe: string,
  endDe: string
): Promise<DartRightsIssue[]> {
  return dartList<DartRightsIssue>("piicDecsn.json", {
    corp_code: corpCode,
    bgn_de: bgnDe,
    end_de: endDe,
  });
}
