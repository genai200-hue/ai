/**
 * 데이터 제공자 seam (서버) — 화면은 이 함수만 통해 공시에 접근한다.
 *
 * mock 단계의 DataProvider.getDisclosures 와 동일한 계약(codes, period)을 유지하고,
 * 내부 구현만 DART 실데이터로 교체한 지점이다(ADR-0001). 새 데이터 접근은
 * 이 경계를 우회하지 말 것.
 */
import type { Disclosure, Period } from "@/lib/types";
import { resolveCorpCode } from "@/lib/dart/corpIndex";
import {
  fetchDisclosureList,
  fetchTreasuryAcq,
  fetchRightsIssue,
  type DartTreasuryAcq,
  type DartRightsIssue,
} from "@/lib/dart/client";
import { classifyType, toDisclosure, isMaterialReport } from "@/lib/dart/enrich";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** period → [bgnDe, endDe] (서버 현재 날짜 기준) */
function rangeOf(period: Period): [string, string] {
  const now = new Date();
  const end = ymd(now);
  const start = new Date(now);
  if (period === "today") {
    // 시작=종료=오늘
  } else if (period === "week") {
    start.setDate(start.getDate() - 6);
  } else {
    start.setDate(start.getDate() - 29);
  }
  return [ymd(start), end];
}

/** 한 종목의 공시 목록 + 정형 정보 결합 */
async function forStock(
  code: string,
  bgnDe: string,
  endDe: string
): Promise<Disclosure[]> {
  const corpCode = resolveCorpCode(code);
  if (!corpCode) return []; // 상장사 색인에 없는 종목코드

  const raw = await fetchDisclosureList(corpCode, bgnDe, endDe);
  const list = raw.filter((i) => isMaterialReport(i.report_nm));
  if (list.length === 0) return [];

  // 정형 API 호출은 해당 유형이 목록에 있을 때만 (호출 수 절약)
  const types = new Set(list.map((i) => classifyType(i.report_nm)));
  const [treasury, rights] = await Promise.all([
    types.has("자기주식")
      ? fetchTreasuryAcq(corpCode, bgnDe, endDe).catch(() => [] as DartTreasuryAcq[])
      : Promise.resolve([] as DartTreasuryAcq[]),
    types.has("유상증자")
      ? fetchRightsIssue(corpCode, bgnDe, endDe).catch(() => [] as DartRightsIssue[])
      : Promise.resolve([] as DartRightsIssue[]),
  ]);

  const treasuryByRcept = new Map(treasury.map((t) => [t.rcept_no, t]));
  const rightsByRcept = new Map(rights.map((r) => [r.rcept_no, r]));

  return list.map((item) =>
    toDisclosure(item, {
      treasury: treasuryByRcept.get(item.rcept_no),
      rights: rightsByRcept.get(item.rcept_no),
    })
  );
}

/**
 * 관심종목 코드 목록 + 기간으로 공시를 조회해 최신순 정렬해 반환.
 * 한 종목 조회가 실패해도 나머지는 반환(부분 성공).
 */
export async function getDisclosures(
  codes: string[],
  period: Period
): Promise<Disclosure[]> {
  const [bgnDe, endDe] = rangeOf(period);

  const perStock = await Promise.all(
    codes.map((code) =>
      forStock(code, bgnDe, endDe).catch((e) => {
        console.error(`[disclosures] ${code} 조회 실패:`, e);
        return [] as Disclosure[];
      })
    )
  );

  return perStock
    .flat()
    .sort((a, b) => (b.submittedMs ?? 0) - (a.submittedMs ?? 0));
}
