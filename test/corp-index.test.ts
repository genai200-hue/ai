/**
 * 전체 상장사 색인(lib/dart/corpIndex.ts) 단위 테스트.
 *
 * 이 색인이 종목 등록 범위를 유니버스 20종목에서 전체 상장사로 넓히는 핵심이다(US-19).
 * resolveCorpCode(코드→corp_code)와 searchStocks(질의→후보)의 계약을 고정한다.
 * 실행: node --import tsx --test test/corp-index.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveCorpCode, searchStocks } from "@/lib/dart/corpIndex";

test("resolveCorpCode — 유니버스 종목은 고정 맵의 corp_code 로 해석된다", () => {
  assert.equal(resolveCorpCode("005930"), "00126380"); // 삼성전자
  assert.equal(resolveCorpCode("000660"), "00164779"); // SK하이닉스
});

test("resolveCorpCode — 유니버스 밖 상장사(유한양행 000100)도 색인으로 해석된다", () => {
  assert.equal(resolveCorpCode("000100"), "00145109");
});

test("resolveCorpCode — 미상장·오타 코드는 undefined", () => {
  assert.equal(resolveCorpCode("999999"), undefined);
  assert.equal(resolveCorpCode(""), undefined);
});

test("searchStocks — 종목명으로 유니버스 밖 상장사를 찾는다(유한양행)", () => {
  const hits = searchStocks("유한양행");
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].code, "000100");
  assert.equal(hits[0].name, "유한양행");
  // 유니버스 밖이므로 배지 없음
  assert.equal(hits[0].inCoreUniverse, false);
});

test("searchStocks — 6자리 코드 질의는 정확 일치 1건", () => {
  const hits = searchStocks("000100");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "유한양행");
});

test("searchStocks — 유니버스 종목은 market·유니버스 배지가 덧입혀진다", () => {
  const hits = searchStocks("삼성전자");
  const samsung = hits.find((h) => h.code === "005930");
  assert.ok(samsung, "삼성전자가 결과에 있어야 함");
  assert.equal(samsung!.inCoreUniverse, true);
  assert.equal(samsung!.market, "KOSPI");
});

test("searchStocks — 빈 질의·공백은 빈 배열", () => {
  assert.deepEqual(searchStocks(""), []);
  assert.deepEqual(searchStocks("   "), []);
});

test("searchStocks — limit 로 결과 개수를 제한한다", () => {
  const hits = searchStocks("전자", 3);
  assert.ok(hits.length <= 3);
});
