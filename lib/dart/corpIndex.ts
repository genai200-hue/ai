/**
 * 전체 상장사 종목 마스터 (서버 전용).
 *
 * 등록 가능한 종목은 주요 종목 유니버스(20)로 제한되지 않는다(스펙 US-19). 사용자가
 * 어떤 상장사를 담아도 동일한 경험을 주기 위해, 검색·corp_code 해석을 DART 기업개황
 * (corpCode.xml)에서 상장사만 추린 전체 색인으로 처리한다.
 *
 * 색인 파일 `corp-index.json` 은 `mcp-server/scripts/build-corp-index.mjs` 로 생성한
 * 스냅샷을 웹앱 소유 경로로 복사한 것이다(배포 시 mcp-server 는 제외되므로 자체 사본
 * 필요). 스키마: {c: corp_code, n: corp_name, s: stock_code}. 상장사만 포함하므로 s 는
 * 항상 6자리 종목코드다. 갱신 시 위 스크립트를 다시 돌려 이 파일을 교체한다.
 *
 * 서버 전용: 이 모듈(및 색인 JSON, 약 210KB)은 클라이언트 번들에 포함돼선 안 된다.
 * 라우트 핸들러·서버 seam(lib/disclosures)에서만 import 한다.
 */
import type { StockSearchItem } from "@/lib/types";
import { STOCK_MASTER } from "@/lib/mock/stocks";
import { CORP_CODE_BY_STOCK } from "@/lib/dart/corpCodes";
import rawIndex from "@/lib/dart/corp-index.json";

interface RawEntry {
  c: string; // corp_code (8자리)
  n: string; // corp_name
  s: string; // stock_code (6자리)
}

interface Company {
  corpCode: string;
  name: string;
  stockCode: string;
}

const COMPANIES: Company[] = (rawIndex as RawEntry[]).map((e) => ({
  corpCode: e.c,
  name: e.n,
  stockCode: e.s,
}));

const byStockCode = new Map<string, Company>();
for (const c of COMPANIES) byStockCode.set(c.stockCode, c);

/** 주요 종목 유니버스 오버레이 (시장 라벨·유니버스 배지용) */
const UNIVERSE_BY_CODE = new Map(STOCK_MASTER.map((s) => [s.code, s]));

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/**
 * 종목코드(6자리) → DART 고유번호(corp_code).
 * 주요 유니버스는 고정 맵을 우선 사용하고, 그 외는 전체 색인에서 해석한다.
 */
export function resolveCorpCode(stockCode: string): string | undefined {
  return CORP_CODE_BY_STOCK[stockCode] ?? byStockCode.get(stockCode)?.corpCode;
}

/** 검색 결과에 유니버스 정보(시장·배지)를 덧입힌다. */
function toSearchItem(c: Company): StockSearchItem {
  const u = UNIVERSE_BY_CODE.get(c.stockCode);
  return {
    code: c.stockCode,
    name: c.name,
    market: u?.market,
    inCoreUniverse: u?.inCoreUniverse ?? false,
  };
}

/**
 * 질의(종목명 또는 6자리 종목코드)로 상장사를 검색한다.
 * - 6자리 숫자 → 종목코드 정확 일치
 * - 그 외 → 이름 정확 일치 우선, 없으면 부분 일치(접두 우선·이름 짧은 순)
 * 유니버스 종목을 동점에서 앞세운다.
 */
export function searchStocks(query: string, limit = 10): StockSearchItem[] {
  const q = query.trim();
  if (!q) return [];

  if (/^\d{6}$/.test(q)) {
    const hit = byStockCode.get(q);
    return hit ? [toSearchItem(hit)] : [];
  }

  const nq = normalize(q);
  if (!nq) return [];

  const matches = COMPANIES.filter((c) => normalize(c.name).includes(nq));
  matches.sort((a, b) => {
    const na = normalize(a.name);
    const nb = normalize(b.name);
    // 1) 정확 일치 우선
    const ae = na === nq ? 0 : 1;
    const be = nb === nq ? 0 : 1;
    if (ae !== be) return ae - be;
    // 2) 접두 일치 우선
    const ap = na.startsWith(nq) ? 0 : 1;
    const bp = nb.startsWith(nq) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    // 3) 유니버스 종목 우선
    const au = UNIVERSE_BY_CODE.has(a.stockCode) ? 0 : 1;
    const bu = UNIVERSE_BY_CODE.has(b.stockCode) ? 0 : 1;
    if (au !== bu) return au - bu;
    // 4) 이름 짧은 순
    return a.name.length - b.name.length;
  });

  return matches.slice(0, limit).map(toSearchItem);
}
