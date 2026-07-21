/**
 * DART 클라이언트(lib/dart/client.ts) 테스트 — 네트워크 없이 globalThis.fetch 스텁.
 *
 * 커버: 키 검증, DART status 봉투 처리(000/013/020/100), HTTP 비정상, URL 구성.
 * 실행: node --import tsx --test test/dart-client.test.ts
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  fetchDisclosureList,
  fetchTreasuryAcq,
  fetchRightsIssue,
} from "@/lib/dart/client";

// ── fetch/env 스텁 관리 (테스트 간 오염 방지) ─────────────────────────────
const REAL_FETCH = globalThis.fetch;
const REAL_KEY = process.env.OPENDART_API_KEY;

interface Envelope {
  status: string;
  message: string;
  list?: unknown[];
}

/** 마지막으로 fetch에 전달된 URL들(검증용) */
let capturedUrls: URL[] = [];
/** 각 테스트가 지정하는 응답 생성기 (throw 하면 네트워크 오류 흉내) */
let handler: (url: URL) => Response;

function jsonResponse(env: Envelope, httpStatus = 200): Response {
  return new Response(JSON.stringify(env), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.OPENDART_API_KEY = "TESTKEY";
  capturedUrls = [];
  handler = () => jsonResponse({ status: "000", message: "정상", list: [] });
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input));
    capturedUrls.push(url);
    return handler(url);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  if (REAL_KEY === undefined) delete process.env.OPENDART_API_KEY;
  else process.env.OPENDART_API_KEY = REAL_KEY;
});

// ── 키 검증 ────────────────────────────────────────────────────────────────
test("키 없음 — OPENDART_API_KEY 미설정 시 문구 포함해 throw", async () => {
  delete process.env.OPENDART_API_KEY;
  await assert.rejects(
    () => fetchDisclosureList("00126380", "20260701", "20260721"),
    /OPENDART_API_KEY/
  );
  // 키가 없으면 네트워크 호출 자체가 없어야 함
  assert.equal(capturedUrls.length, 0);
});

// ── status 봉투 처리 ────────────────────────────────────────────────────────
test("status 000 — list 배열을 그대로 반환", async () => {
  const rows = [
    { rcept_no: "1", report_nm: "A" },
    { rcept_no: "2", report_nm: "B" },
  ];
  handler = () => jsonResponse({ status: "000", message: "정상", list: rows });
  const out = await fetchDisclosureList("00126380", "20260701", "20260721");
  assert.equal(out.length, 2);
  assert.equal(out[0].rcept_no, "1");
});

test("status 000 — list 누락 시 빈 배열", async () => {
  handler = () => jsonResponse({ status: "000", message: "정상" });
  const out = await fetchDisclosureList("00126380", "20260701", "20260721");
  assert.deepEqual(out, []);
});

test("status 013 — 조회 데이터 없음은 throw가 아니라 빈 배열", async () => {
  handler = () =>
    jsonResponse({ status: "013", message: "조회된 데이터가 없습니다." });
  const out = await fetchTreasuryAcq("00126380", "20260701", "20260721");
  assert.deepEqual(out, []);
});

test("status 020 — 사용한도 초과는 status/message 포함해 throw", async () => {
  handler = () =>
    jsonResponse({ status: "020", message: "요청 제한을 초과하였습니다." });
  await assert.rejects(
    () => fetchDisclosureList("00126380", "20260701", "20260721"),
    (e: Error) => {
      assert.match(e.message, /status=020/);
      assert.match(e.message, /요청 제한을 초과하였습니다/);
      return true;
    }
  );
});

test("status 100 — 파라미터/키 오류도 throw", async () => {
  handler = () =>
    jsonResponse({ status: "100", message: "필드의 부적절한 값입니다." });
  await assert.rejects(
    () => fetchRightsIssue("00126380", "20260701", "20260721"),
    /status=100/
  );
});

// ── HTTP 비정상 ─────────────────────────────────────────────────────────────
test("HTTP 500 — res.ok=false 이면 HTTP 상태 포함해 throw", async () => {
  handler = () => jsonResponse({ status: "000", message: "정상" }, 500);
  await assert.rejects(
    () => fetchDisclosureList("00126380", "20260701", "20260721"),
    /HTTP 500/
  );
});

// ── URL 구성 ────────────────────────────────────────────────────────────────
test("fetchDisclosureList — 쿼리 파라미터 구성", async () => {
  await fetchDisclosureList("00126380", "20260101", "20260721");
  assert.equal(capturedUrls.length, 1);
  const u = capturedUrls[0];
  assert.match(u.pathname, /\/api\/list\.json$/);
  const q = u.searchParams;
  assert.equal(q.get("crtfc_key"), "TESTKEY"); // 서버 전용 호출(값 존재만 확인)
  assert.equal(q.get("corp_code"), "00126380");
  assert.equal(q.get("bgn_de"), "20260101");
  assert.equal(q.get("end_de"), "20260721");
  assert.equal(q.get("page_no"), "1");
  assert.equal(q.get("page_count"), "100");
});

test("fetchTreasuryAcq / fetchRightsIssue — 엔드포인트·공통 파라미터", async () => {
  await fetchTreasuryAcq("00164779", "20260101", "20260721");
  await fetchRightsIssue("00164779", "20260101", "20260721");
  assert.match(capturedUrls[0].pathname, /\/api\/tsstkAqDecsn\.json$/);
  assert.match(capturedUrls[1].pathname, /\/api\/piicDecsn\.json$/);
  for (const u of capturedUrls) {
    assert.equal(u.searchParams.get("crtfc_key"), "TESTKEY");
    assert.equal(u.searchParams.get("corp_code"), "00164779");
    assert.equal(u.searchParams.get("bgn_de"), "20260101");
    assert.equal(u.searchParams.get("end_de"), "20260721");
  }
});
