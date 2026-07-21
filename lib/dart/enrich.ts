/**
 * DART 원본 → 도메인 Disclosure 변환.
 *
 * - 유형 분류: report_nm 키워드 기반.
 * - 정형 수치: 정형 API가 있는 유형(자기주식취득·유상증자)만 채우고, 없으면 생략.
 * - 요약: 정형 값과 목록 메타로 만든 **사실 중립 서술**(ADR-0003: 전망·평가·매매의견 금지).
 *   목록 API에 없는 금액을 지어내지 않는다.
 */
import type { Disclosure, StructuredField } from "@/lib/types";
import type {
  DartListItem,
  DartTreasuryAcq,
  DartRightsIssue,
} from "@/lib/dart/client";

/** 공시 원문 뷰어 URL */
export function dartUrl(rceptNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;
}

/** report_nm 앞뒤/중복 공백 정리 (DART는 공백으로 우측 패딩함) */
function cleanTitle(reportNm: string): string {
  return reportNm.replace(/\s+/g, " ").trim();
}

/**
 * '주요' 공시 여부. 실 DART 피드는 임원·주요주주의 정기 지분신고가 대량으로
 * 쏟아져 관심종목의 실적·계약·자본거래 공시를 덮는다. 제품 취지(관심종목 공시
 * 요약)에 맞춰 노이즈성 정기 지분신고를 기본 제외한다. 필요하면 이 목록을 조정.
 */
const NOISE_REPORTS = [
  "특정증권등소유상황보고서",
  "최대주주등소유주식변동신고서",
];
export function isMaterialReport(reportNm: string): boolean {
  return !NOISE_REPORTS.some((n) => reportNm.includes(n));
}

/** report_nm 키워드로 공시유형 라벨 도출 */
export function classifyType(reportNm: string): string {
  const t = reportNm;
  // 영업(잠정)실적만 '실적'. "증권발행실적보고서" 같은 발행결과 보고서는 제외.
  if (/영업.*실적|잠정실적/.test(t)) return "실적";
  if (t.includes("공급계약") || t.includes("단일판매")) return "공급계약";
  if (t.includes("자기주식")) return "자기주식";
  // '유상증자결정'만 유상증자로. 발행결과·자율공시는 아래 사채발행/기타로 흘려보냄.
  if (t.includes("유상증자") && t.includes("결정")) return "유상증자";
  if (t.includes("무상증자") && t.includes("결정")) return "무상증자";
  if (t.includes("배당")) return "배당";
  if (t.includes("소송")) return "소송";
  if (t.includes("합병") || t.includes("분할")) return "합병·분할";
  if (t.includes("감자")) return "감자";
  if (t.includes("전환사채") || t.includes("신주인수권부사채") || t.includes("교환사채"))
    return "사채발행";
  if (t.includes("대량보유") || t.includes("특정증권등소유") || t.includes("주요주주"))
    return "지분공시";
  if (t.includes("기업설명회") || t.includes("IR")) return "IR";
  return "기타";
}

/** YYYYMMDD → epoch ms (로컬 자정) */
export function rceptDtToMs(rceptDt: string): number {
  const y = Number(rceptDt.slice(0, 4));
  const m = Number(rceptDt.slice(4, 6));
  const d = Number(rceptDt.slice(6, 8));
  return new Date(y, m - 1, d).getTime();
}

/** 숫자 문자열 → "1,234,567원" (없거나 '-' 이면 null) */
function formatWon(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits || digits === "0") return null;
  return `${Number(digits).toLocaleString("ko-KR")}원`;
}

/** 한글 받침 유무로 조사 선택 (비한글은 받침 없음 취급) */
function josa(word: string, withJong: string, withoutJong: string): string {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  if (!isHangul) return withoutJong;
  return (last - 0xac00) % 28 !== 0 ? withJong : withoutJong;
}

interface Extra {
  treasury?: DartTreasuryAcq;
  rights?: DartRightsIssue;
}

/** 정형 수치(주요 항목) 구성 — 정형 API가 있는 유형만 */
function buildStructured(type: string, extra: Extra): StructuredField[] {
  if (type === "자기주식" && extra.treasury) {
    const t = extra.treasury;
    const fields: StructuredField[] = [];
    const amt = formatWon(t.aqpln_prc_ostk);
    if (amt) fields.push({ label: "취득예정금액", value: amt, emphasize: true });
    if (t.aq_mth && t.aq_mth !== "-")
      fields.push({ label: "취득방법", value: t.aq_mth.trim() });
    if (t.aqexpd_bgd && t.aqexpd_bgd !== "-")
      fields.push({
        label: "취득예상기간",
        value: `${t.aqexpd_bgd.trim()} ~ ${(t.aqexpd_edd || "").trim()}`,
      });
    if (t.aq_pp && t.aq_pp !== "-")
      fields.push({ label: "취득목적", value: t.aq_pp.trim() });
    return fields;
  }
  if (type === "유상증자" && extra.rights) {
    const r = extra.rights;
    const fields: StructuredField[] = [];
    if (r.ic_mthn && r.ic_mthn !== "-")
      fields.push({ label: "증자방식", value: r.ic_mthn.trim() });
    if (r.nstk_ostk_cnt && r.nstk_ostk_cnt !== "-")
      fields.push({
        label: "신주 보통주식수",
        value: `${r.nstk_ostk_cnt.trim()}주`,
        emphasize: true,
      });
    const fac = formatWon(r.fdpp_fclt);
    if (fac) fields.push({ label: "자금조달(시설)", value: fac });
    const op = formatWon(r.fdpp_op);
    if (op) fields.push({ label: "자금조달(운영)", value: op });
    return fields;
  }
  return [];
}

/** 사실 중립 요약(2~3줄) — 정형 값이 있으면 수치 문장 추가 */
function buildSummary(
  item: DartListItem,
  type: string,
  structured: StructuredField[]
): string[] {
  const title = cleanTitle(item.report_nm);
  const name = item.corp_name;
  const dt = `${item.rcept_dt.slice(0, 4)}.${item.rcept_dt.slice(4, 6)}.${item.rcept_dt.slice(6, 8)}`;
  const lines: string[] = [];

  lines.push(
    `${name}${josa(name, "이", "가")} '${title}'${josa(title, "을", "를")} 공시했다.`
  );
  lines.push(`접수일자는 ${dt}, 제출인은 ${item.flr_nm.trim()}(으)로 기재됐다.`);

  const emph = structured.find((f) => f.emphasize);
  if (type === "자기주식" && emph) {
    const method = structured.find((f) => f.label === "취득방법");
    lines.push(
      `취득 예정 금액은 ${emph.value}${method ? `, 취득 방법은 ${method.value}` : ""}(으)로 기재됐다.`
    );
  } else if (type === "유상증자" && structured.length) {
    lines.push(`발행·자금 조달 내역이 정형 항목으로 함께 공시됐다.`);
  } else {
    lines.push(`구체적 수치와 세부 내용은 원문 공시에서 확인할 수 있다.`);
  }
  return lines;
}

/** DART 목록 항목 + 정형 정보 → Disclosure */
export function toDisclosure(item: DartListItem, extra: Extra): Disclosure {
  const type = classifyType(item.report_nm);
  const structured = buildStructured(type, extra);
  const aiSummary = buildSummary(item, type, structured);
  return {
    id: item.rcept_no,
    stockCode: item.stock_code,
    stockName: item.corp_name,
    type,
    title: cleanTitle(item.report_nm),
    hoursAgo: 0, // 실데이터는 submittedMs 사용
    submittedMs: rceptDtToMs(item.rcept_dt),
    sourceUrl: dartUrl(item.rcept_no),
    structured,
    aiSummary,
  };
}
