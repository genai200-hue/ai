/**
 * 회사명/종목코드 → DART 고유번호(corp_code) 해석.
 *
 * data/corp-index.json 은 DART 기업개황(corpCode.xml)에서 상장사만 추린 공개
 * 데이터다. (스키마: {c: corp_code, n: corp_name, s: stock_code})
 */
import { readFileSync } from "node:fs";
import { MAX_COMPANY_MATCHES } from "./constants.js";

export interface Company {
  corpCode: string;
  corpName: string;
  stockCode: string;
}

interface RawEntry {
  c: string;
  n: string;
  s: string;
}

const INDEX_URL = new URL("../data/corp-index.json", import.meta.url);

const COMPANIES: Company[] = (
  JSON.parse(readFileSync(INDEX_URL, "utf8")) as RawEntry[]
).map((e) => ({ corpCode: e.c, corpName: e.n, stockCode: e.s }));

const byExactName = new Map<string, Company[]>();
const byStockCode = new Map<string, Company>();
for (const c of COMPANIES) {
  byStockCode.set(c.stockCode, c);
  const key = normalize(c.corpName);
  const arr = byExactName.get(key);
  if (arr) arr.push(c);
  else byExactName.set(key, [c]);
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/**
 * 질의(회사명 또는 6자리 종목코드)로 회사를 찾는다.
 * - 6자리 숫자 → 종목코드 정확 일치
 * - 그 외 → 이름 정확 일치 우선, 없으면 부분 일치
 * 반환은 관련도 순, 최대 MAX_COMPANY_MATCHES 건.
 */
export function resolveCompanies(query: string): Company[] {
  const q = query.trim();
  if (/^\d{6}$/.test(q)) {
    const hit = byStockCode.get(q);
    return hit ? [hit] : [];
  }
  const nq = normalize(q);
  if (!nq) return [];

  const exact = byExactName.get(nq);
  if (exact && exact.length) return exact.slice(0, MAX_COMPANY_MATCHES);

  // 부분 일치: 접두 일치를 앞세우고 이름 길이 짧은 순으로 정렬
  const partial = COMPANIES.filter((c) => normalize(c.corpName).includes(nq));
  partial.sort((a, b) => {
    const ap = normalize(a.corpName).startsWith(nq) ? 0 : 1;
    const bp = normalize(b.corpName).startsWith(nq) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.corpName.length - b.corpName.length;
  });
  return partial.slice(0, MAX_COMPANY_MATCHES);
}

export const COMPANY_COUNT = COMPANIES.length;
