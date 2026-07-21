/**
 * corp_code 매핑 테스트 + 종목 마스터와의 정합성.
 * CORP_CODE_BY_STOCK / corpCodeOf 의 형식과, STOCK_MASTER ↔ 매핑 표의 1:1 정합을 고정한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CORP_CODE_BY_STOCK, corpCodeOf } from "@/lib/dart/corpCodes";
import { STOCK_MASTER } from "@/lib/mock/stocks";

test("CORP_CODE_BY_STOCK — key는 6자리 종목코드, value는 8자리 corp_code", () => {
  const entries = Object.entries(CORP_CODE_BY_STOCK);
  assert.ok(entries.length > 0);
  for (const [stockCode, corpCode] of entries) {
    assert.match(stockCode, /^\d{6}$/, `종목코드 6자리: ${stockCode}`);
    assert.match(corpCode, /^\d{8}$/, `corp_code 8자리: ${stockCode}=${corpCode}`);
  }
});

test("CORP_CODE_BY_STOCK — corp_code 값에 중복이 없다", () => {
  const values = Object.values(CORP_CODE_BY_STOCK);
  assert.equal(new Set(values).size, values.length);
});

test("corpCodeOf — 알려진 코드는 정확한 corp_code 로 매핑된다", () => {
  assert.equal(corpCodeOf("005930"), "00126380"); // 삼성전자
  assert.equal(corpCodeOf("000660"), "00164779"); // SK하이닉스
});

test("corpCodeOf — 미등록 코드는 undefined 를 반환한다", () => {
  assert.equal(corpCodeOf("999999"), undefined);
  assert.equal(corpCodeOf(""), undefined);
});

test("정합성 — STOCK_MASTER 의 모든 종목이 corp_code 매핑을 가진다", () => {
  for (const s of STOCK_MASTER) {
    assert.ok(
      corpCodeOf(s.code),
      `마스터 종목에 corp_code 매핑 없음: ${s.code}(${s.name})`
    );
  }
});

test("정합성 — 매핑 표의 모든 종목코드가 STOCK_MASTER 에 존재한다(불일치 방지)", () => {
  const masterCodes = new Set(STOCK_MASTER.map((s) => s.code));
  for (const code of Object.keys(CORP_CODE_BY_STOCK)) {
    assert.ok(
      masterCodes.has(code),
      `매핑 표에 마스터 밖 종목코드가 있음: ${code}`
    );
  }
});

test("정합성 — 마스터와 매핑 표의 종목 수가 일치한다(20종목)", () => {
  assert.equal(STOCK_MASTER.length, Object.keys(CORP_CODE_BY_STOCK).length);
});
