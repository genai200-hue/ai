#!/usr/bin/env node
/**
 * opendart-mcp-server
 *
 * 회사명을 받아 최근 DART 공시를 사실 중립 요약으로 반환하는 MCP 서버.
 * 인증키(OPENDART_API_KEY)는 서버 프로세스 환경변수에서만 사용한다.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { CHARACTER_LIMIT } from "./constants.js";
import { resolveCompanies, COMPANY_COUNT, type Company } from "./company.js";
import {
  fetchDisclosureList,
  fetchTreasuryAcq,
  fetchRightsIssue,
  DartError,
  type DartTreasuryAcq,
  type DartRightsIssue,
} from "./dart.js";
import {
  classifyType,
  isMaterialReport,
  toDisclosure,
  fmtDate,
  type Disclosure,
} from "./enrich.js";

/* ------------------------------ 공통 로직 ------------------------------ */

type Period = "today" | "week" | "month";

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function rangeOf(period: Period): [string, string] {
  const now = new Date();
  const end = ymd(now);
  const start = new Date(now);
  if (period === "week") start.setDate(start.getDate() - 6);
  else if (period === "month") start.setDate(start.getDate() - 29);
  return [ymd(start), end];
}

/** 한 회사의 기간 내 주요 공시를 정형 정보와 결합해 최신순으로 반환 */
async function getRecentDisclosures(
  corpCode: string,
  period: Period
): Promise<Disclosure[]> {
  const [bgnDe, endDe] = rangeOf(period);
  const raw = await fetchDisclosureList(corpCode, bgnDe, endDe);
  const list = raw.filter((i) => isMaterialReport(i.report_nm));
  if (list.length === 0) return [];

  const types = new Set(list.map((i) => classifyType(i.report_nm)));
  const [treasury, rights] = await Promise.all([
    types.has("자기주식")
      ? fetchTreasuryAcq(corpCode, bgnDe, endDe).catch(() => [] as DartTreasuryAcq[])
      : Promise.resolve([] as DartTreasuryAcq[]),
    types.has("유상증자")
      ? fetchRightsIssue(corpCode, bgnDe, endDe).catch(() => [] as DartRightsIssue[])
      : Promise.resolve([] as DartRightsIssue[]),
  ]);
  const tByRcept = new Map(treasury.map((t) => [t.rcept_no, t]));
  const rByRcept = new Map(rights.map((r) => [r.rcept_no, r]));

  return list
    .map((item) =>
      toDisclosure(item, {
        treasury: tByRcept.get(item.rcept_no),
        rights: rByRcept.get(item.rcept_no),
      })
    )
    .sort((a, b) => (a.rceptDt < b.rceptDt ? 1 : a.rceptDt > b.rceptDt ? -1 : 0));
}

const PERIOD_LABEL: Record<Period, string> = {
  today: "오늘",
  week: "최근 1주",
  month: "최근 1개월",
};

/* ------------------------------ 포맷팅 ------------------------------ */

function companyLine(c: Company): string {
  return `${c.corpName} (${c.stockCode} · corp_code ${c.corpCode})`;
}

function toMarkdown(
  company: Company,
  period: Period,
  items: Disclosure[]
): string {
  const lines: string[] = [];
  lines.push(`# ${company.corpName} — ${PERIOD_LABEL[period]} 공시 요약`);
  lines.push(`종목코드 ${company.stockCode} · ${items.length}건`);
  lines.push("");
  if (items.length === 0) {
    lines.push("이 기간에 접수된 주요 공시가 없습니다.");
    lines.push("");
  }
  for (const d of items) {
    lines.push(`## [${d.type}] ${d.title}`);
    lines.push(`- 접수일: ${fmtDate(d.rceptDt)} · 제출인: ${d.filer}`);
    if (d.structured.length) {
      const parts = d.structured.map((f) => `${f.label} ${f.value}`);
      lines.push(`- 주요 항목: ${parts.join(" · ")}`);
    }
    for (const s of d.summary) lines.push(`- ${s}`);
    lines.push(`- 원문: ${d.sourceUrl}`);
    lines.push("");
  }
  lines.push(
    "> 사실 중립 정보 제공용이며, 특정 종목의 매수·매도나 투자를 권유하지 않습니다. 투자 판단과 책임은 투자자 본인에게 있습니다."
  );
  return lines.join("\n");
}

/* ------------------------------ 서버 ------------------------------ */

const server = new McpServer({
  name: "opendart-mcp-server",
  version: "1.0.0",
});

const PeriodEnum = z.enum(["today", "week", "month"]);
const FormatEnum = z.enum(["markdown", "json"]);

server.registerTool(
  "dart_summarize_recent_disclosures",
  {
    title: "최근 공시 요약",
    description: `회사명(또는 6자리 종목코드)을 받아 최근 DART 공시를 사실 중립 요약으로 반환한다.

공시 제목·유형·접수일·제출인과, 정형 API가 있는 유형(자기주식취득결정·유상증자결정)의 실제 수치, 그리고 각 공시의 원문(DART) 링크를 함께 제공한다. 임원·주요주주의 정기 지분신고 같은 노이즈성 공시는 제외한다. 전망·평가·매매의견은 포함하지 않는다.

Args:
  - company_name (string): 회사명(부분 일치 가능) 또는 6자리 종목코드. 예) "삼성전자", "005930", "카카오"
  - period ('today'|'week'|'month'): 조회 기간 (기본 'week')
  - response_format ('markdown'|'json'): 출력 형식 (기본 'markdown')

동작:
  - 회사명이 여러 상장사와 일치하면 요약 대신 후보 목록을 돌려준다(회사명을 더 구체화하거나 종목코드 사용).
  - 상장사 색인에 없으면 그 사실을 알린다.

Returns (json):
  {
    "company": { "corpName": string, "stockCode": string, "corpCode": string },
    "period": "today"|"week"|"month",
    "count": number,
    "disclosures": [
      { "rceptNo": string, "type": string, "title": string, "rceptDt": "YYYYMMDD",
        "filer": string, "sourceUrl": string,
        "structured": [{"label": string, "value": string, "emphasize"?: boolean}],
        "summary": string[] }
    ]
  }

예:
  - "삼성전자 최근 공시 요약해줘" → company_name="삼성전자"
  - "카카오 이번 달 공시" → company_name="카카오", period="month"`,
    inputSchema: {
      company_name: z
        .string()
        .min(1, "회사명 또는 종목코드를 입력하세요")
        .max(60)
        .describe("회사명(부분 일치 가능) 또는 6자리 종목코드"),
      period: PeriodEnum.default("week").describe("조회 기간 (today|week|month)"),
      response_format: FormatEnum.default("markdown").describe(
        "출력 형식 (markdown|json)"
      ),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ company_name, period, response_format }) => {
    try {
      const matches = resolveCompanies(company_name);

      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `'${company_name}'과(와) 일치하는 상장사를 찾지 못했습니다. 정확한 회사명이나 6자리 종목코드로 다시 시도하세요. (색인된 상장사 ${COMPANY_COUNT}개)`,
            },
          ],
        };
      }
      if (matches.length > 1) {
        const list = matches.map((c) => `- ${companyLine(c)}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text: `'${company_name}'과(와) 일치하는 상장사가 여러 곳입니다. 하나를 골라 종목코드로 다시 요청하세요.\n\n${list}`,
            },
          ],
          structuredContent: {
            ambiguous: true,
            candidates: matches,
          },
        };
      }

      const company = matches[0];
      const items = await getRecentDisclosures(company.corpCode, period);

      const structured = {
        company: {
          corpName: company.corpName,
          stockCode: company.stockCode,
          corpCode: company.corpCode,
        },
        period,
        count: items.length,
        disclosures: items,
      };

      let text =
        response_format === "json"
          ? JSON.stringify(structured, null, 2)
          : toMarkdown(company, period, items);

      if (text.length > CHARACTER_LIMIT) {
        const kept = Math.max(1, Math.floor(items.length / 2));
        const trimmed = { ...structured, count: kept, disclosures: items.slice(0, kept) };
        const note = `\n\n> 응답이 길어 ${items.length}건 중 ${kept}건만 표시했습니다. period를 좁히거나 종목코드로 재요청하세요.`;
        text =
          response_format === "json"
            ? JSON.stringify({ ...trimmed, truncated: true }, null, 2)
            : toMarkdown(company, period, items.slice(0, kept)) + note;
      }

      return {
        content: [{ type: "text", text }],
        structuredContent: structured,
      };
    } catch (error) {
      const msg =
        error instanceof DartError
          ? `DART 오류: ${error.message}`
          : `예기치 못한 오류: ${error instanceof Error ? error.message : String(error)}`;
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  }
);

server.registerTool(
  "dart_find_company",
  {
    title: "상장사 검색",
    description: `회사명 일부로 상장사를 검색해 후보(회사명·종목코드·corp_code)를 반환한다. 회사명이 모호할 때 종목코드를 확정하는 용도.

Args:
  - query (string): 회사명 일부 또는 6자리 종목코드

Returns (json): { "count": number, "companies": [{ "corpName": string, "stockCode": string, "corpCode": string }] }`,
    inputSchema: {
      query: z.string().min(1, "검색어를 입력하세요").max(60).describe("회사명 일부 또는 6자리 종목코드"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ query }) => {
    const matches = resolveCompanies(query);
    const structured = { count: matches.length, companies: matches };
    const text = matches.length
      ? `일치 ${matches.length}건:\n` + matches.map((c) => `- ${companyLine(c)}`).join("\n")
      : `'${query}'과(와) 일치하는 상장사가 없습니다. (색인 ${COMPANY_COUNT}개)`;
    return {
      content: [{ type: "text", text }],
      structuredContent: structured,
    };
  }
);

/* ------------------------------ 실행 ------------------------------ */

async function main() {
  if (!process.env.OPENDART_API_KEY) {
    console.error(
      "ERROR: OPENDART_API_KEY 환경변수가 필요합니다. OpenDART 인증키를 설정한 뒤 다시 실행하세요."
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`opendart-mcp-server 실행 중 (stdio) · 상장사 색인 ${COMPANY_COUNT}개`);
}

main().catch((e) => {
  console.error("서버 오류:", e);
  process.exit(1);
});
