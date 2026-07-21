/**
 * GET /api/stocks 라우트 계약 테스트.
 *
 * 종목 검색 seam. 네트워크 없이 전체 상장사 색인만으로 응답한다.
 * 계약: (1) q 없으면 {items:[]}, (2) 종목명/코드로 매칭 결과 {items:[...]} 반환.
 * 실행: node --import tsx --test test/api-stocks.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { GET } from "@/app/api/stocks/route";
import type { StockSearchItem } from "@/lib/types";

function makeReq(query: string): Request {
  return new Request(`https://example.test/api/stocks${query}`);
}
async function items(query: string): Promise<StockSearchItem[]> {
  const res = await GET(makeReq(query));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { items: StockSearchItem[] };
  assert.ok(Array.isArray(body.items));
  return body.items;
}

test("q 누락·공백 — fetch 없이 {items:[]}", async () => {
  assert.deepEqual(await items(""), []);
  assert.deepEqual(await items("?q=%20%20"), []);
});

test("종목명 검색 — 유니버스 밖 상장사(유한양행)도 찾는다", async () => {
  const out = await items("?q=유한양행");
  assert.ok(out.length >= 1);
  assert.equal(out[0].code, "000100");
  assert.equal(out[0].name, "유한양행");
});

test("코드 검색 — 6자리 코드는 정확 일치 1건", async () => {
  const out = await items("?q=005930");
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "삼성전자");
  assert.equal(out[0].inCoreUniverse, true);
});

test("결과 개수 상한 — 최대 8건", async () => {
  const out = await items("?q=전자");
  assert.ok(out.length <= 8);
});
