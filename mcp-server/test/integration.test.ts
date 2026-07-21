/**
 * 통합 테스트 — 빌드된 서버를 실제 stdio로 띄워 도구를 호출한다.
 * OPENDART_API_KEY 가 있어야 실행되며(라이브 데이터), 없으면 스킵한다.
 * 사전 조건: npm run build (dist/index.js 필요).
 * 실행: OPENDART_API_KEY=... npm run test:integration
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HAS_KEY = !!process.env.OPENDART_API_KEY;
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");

let client: Client;

before(async () => {
  if (!HAS_KEY) return;
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env } as Record<string, string>,
  });
  client = new Client({ name: "integration-test", version: "1.0.0" });
  await client.connect(transport);
});

after(async () => {
  if (client) await client.close();
});

test("tools/list — 두 도구가 노출된다", { skip: !HAS_KEY && "OPENDART_API_KEY 미설정" }, async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["dart_find_company", "dart_summarize_recent_disclosures"]);
});

test("dart_find_company — 삼성전자 → 005930", { skip: !HAS_KEY && "OPENDART_API_KEY 미설정" }, async () => {
  const res = await client.callTool({
    name: "dart_find_company",
    arguments: { query: "삼성전자" },
  });
  const sc = res.structuredContent as { companies: { stockCode: string }[] };
  assert.ok(sc.companies.some((c) => c.stockCode === "005930"));
});

test("dart_summarize_recent_disclosures — 종목코드로 조회 시 구조가 일관됨", { skip: !HAS_KEY && "OPENDART_API_KEY 미설정" }, async () => {
  const res = await client.callTool({
    name: "dart_summarize_recent_disclosures",
    arguments: { company_name: "005930", period: "month", response_format: "json" },
  });
  const sc = res.structuredContent as {
    company: { stockCode: string; corpCode: string };
    period: string;
    count: number;
    disclosures: { rceptNo: string; type: string; sourceUrl: string; summary: string[] }[];
  };
  assert.equal(sc.company.stockCode, "005930");
  assert.equal(sc.period, "month");
  assert.equal(sc.count, sc.disclosures.length);
  // 반환된 각 공시는 필수 필드를 갖춘다
  for (const d of sc.disclosures) {
    assert.match(d.rceptNo, /^\d{14}$/);
    assert.ok(d.type.length > 0);
    assert.match(d.sourceUrl, /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/);
    assert.ok(Array.isArray(d.summary) && d.summary.length >= 2);
  }
  // 노이즈성 지분신고는 제외돼야 한다
  assert.ok(
    sc.disclosures.every((d) => !d.summary[0].includes("특정증권등소유상황보고서")),
    "노이즈 공시가 포함되면 안 됨"
  );
});

test("dart_summarize_recent_disclosures — 모호한 이름은 후보를 반환", { skip: !HAS_KEY && "OPENDART_API_KEY 미설정" }, async () => {
  const res = await client.callTool({
    name: "dart_summarize_recent_disclosures",
    arguments: { company_name: "삼성" },
  });
  const sc = res.structuredContent as { ambiguous?: boolean; candidates?: unknown[] };
  assert.equal(sc.ambiguous, true);
  assert.ok(Array.isArray(sc.candidates) && sc.candidates.length > 1);
});

test("dart_summarize_recent_disclosures — 없는 회사명은 안내 메시지", { skip: !HAS_KEY && "OPENDART_API_KEY 미설정" }, async () => {
  const res = await client.callTool({
    name: "dart_summarize_recent_disclosures",
    arguments: { company_name: "존재하지않는회사zzz" },
  });
  const text = (res.content as { type: string; text: string }[])[0].text;
  assert.match(text, /찾지 못했습니다/);
});
