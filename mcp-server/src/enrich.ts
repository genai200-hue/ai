/**
 * DART 원본 → 도메인 공시 + 사실 중립 요약.
 *
 * ADR-0003 준수: 전망·평가·매매의견 없이 사실만 서술. 정형 API가 없는 유형은
 * 수치를 지어내지 않고 목록 정보 + 원문 링크로 처리한다.
 */
import { DART_VIEWER_BASE } from "./constants.js";
import type {
  DartListItem,
  DartTreasuryAcq,
  DartRightsIssue,
} from "./dart.js";

export interface StructuredField {
  label: string;
  value: string;
  emphasize?: boolean;
}

export interface Disclosure {
  rceptNo: string;
  corpName: string;
  stockCode: string;
  type: string;
  title: string;
  rceptDt: string; // YYYYMMDD
  filer: string;
  sourceUrl: string;
  structured: StructuredField[];
  summary: string[];
}

export function dartUrl(rceptNo: string): string {
  return `${DART_VIEWER_BASE}?rcpNo=${rceptNo}`;
}

function cleanTitle(reportNm: string): string {
  return reportNm.replace(/\s+/g, " ").trim();
}

/** 노이즈성 정기 지분신고는 기본 제외 */
const NOISE_REPORTS = ["특정증권등소유상황보고서", "최대주주등소유주식변동신고서"];
export function isMaterialReport(reportNm: string): boolean {
  return !NOISE_REPORTS.some((n) => reportNm.includes(n));
}

export function classifyType(reportNm: string): string {
  const t = reportNm;
  if (/영업.*실적|잠정실적/.test(t)) return "실적";
  if (t.includes("공급계약") || t.includes("단일판매")) return "공급계약";
  if (t.includes("자기주식")) return "자기주식";
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

function fmtDate(rceptDt: string): string {
  return `${rceptDt.slice(0, 4)}.${rceptDt.slice(4, 6)}.${rceptDt.slice(6, 8)}`;
}

function formatWon(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits || digits === "0") return null;
  return `${Number(digits).toLocaleString("ko-KR")}원`;
}

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

function buildSummary(
  item: DartListItem,
  type: string,
  structured: StructuredField[]
): string[] {
  const title = cleanTitle(item.report_nm);
  const name = item.corp_name;
  const lines: string[] = [];
  lines.push(
    `${name}${josa(name, "이", "가")} '${title}'${josa(title, "을", "를")} 공시했다.`
  );
  lines.push(`접수일자는 ${fmtDate(item.rcept_dt)}, 제출인은 ${item.flr_nm.trim()}(으)로 기재됐다.`);

  const emph = structured.find((f) => f.emphasize);
  if (type === "자기주식" && emph) {
    const method = structured.find((f) => f.label === "취득방법");
    lines.push(
      `취득 예정 금액은 ${emph.value}${method ? `, 취득 방법은 ${method.value}` : ""}(으)로 기재됐다.`
    );
  } else if (type === "유상증자" && structured.length) {
    lines.push("발행·자금 조달 내역이 정형 항목으로 함께 공시됐다.");
  } else {
    lines.push("구체적 수치와 세부 내용은 원문 공시에서 확인할 수 있다.");
  }
  return lines;
}

export function toDisclosure(item: DartListItem, extra: Extra): Disclosure {
  const type = classifyType(item.report_nm);
  const structured = buildStructured(type, extra);
  const summary = buildSummary(item, type, structured);
  return {
    rceptNo: item.rcept_no,
    corpName: item.corp_name,
    stockCode: item.stock_code,
    type,
    title: cleanTitle(item.report_nm),
    rceptDt: item.rcept_dt,
    filer: item.flr_nm.trim(),
    sourceUrl: dartUrl(item.rcept_no),
    structured,
    summary,
  };
}

export { fmtDate };
