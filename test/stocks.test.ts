/**
 * 종목 마스터(고정 유니버스) 정합성 테스트.
 * STOCK_MASTER / DEFAULT_WATCHLIST / findStock 의 불변식을 고정한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STOCK_MASTER,
  DEFAULT_WATCHLIST,
  findStock,
} from "@/lib/mock/stocks";

test("STOCK_MASTER — 20종목이며 각 항목의 형식이 유효하다", () => {
  assert.equal(STOCK_MASTER.length, 20);
  for (const s of STOCK_MASTER) {
    assert.match(s.code, /^\d{6}$/, `종목코드는 6자리 숫자: ${s.code}`);
    assert.equal(typeof s.name, "string");
    assert.ok(s.name.trim().length > 0, `종목명이 비어있음: ${s.code}`);
    assert.ok(
      s.market === "KOSPI" || s.market === "KOSDAQ",
      `market 은 KOSPI|KOSDAQ: ${s.code}=${s.market}`
    );
    assert.equal(typeof s.inCoreUniverse, "boolean");
  }
});

test("STOCK_MASTER — 종목코드 중복이 없다", () => {
  const codes = STOCK_MASTER.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("STOCK_MASTER — KOSPI와 KOSDAQ 종목이 모두 존재한다(한쪽 치우침 방지)", () => {
  const kospi = STOCK_MASTER.filter((s) => s.market === "KOSPI");
  const kosdaq = STOCK_MASTER.filter((s) => s.market === "KOSDAQ");
  assert.ok(kospi.length >= 1, "KOSPI 종목이 최소 1건");
  assert.ok(kosdaq.length >= 1, "KOSDAQ 종목이 최소 1건");
});

test("findStock — 존재하는 코드는 해당 Stock 을 반환한다", () => {
  const s = findStock("005930");
  assert.ok(s);
  assert.equal(s!.code, "005930");
  assert.equal(s!.name, "삼성전자");
  assert.equal(s!.market, "KOSPI");
});

test("findStock — 없는 코드는 undefined 를 반환한다", () => {
  assert.equal(findStock("999999"), undefined);
  assert.equal(findStock(""), undefined);
});

test("DEFAULT_WATCHLIST — 모든 코드가 STOCK_MASTER 에 실제 존재한다", () => {
  for (const code of DEFAULT_WATCHLIST) {
    assert.ok(
      findStock(code),
      `기본 관심종목이 마스터에 없음: ${code}`
    );
  }
});

test("DEFAULT_WATCHLIST — 중복이 없다", () => {
  assert.equal(
    new Set(DEFAULT_WATCHLIST).size,
    DEFAULT_WATCHLIST.length
  );
});
