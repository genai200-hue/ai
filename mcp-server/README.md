# opendart-mcp-server

회사명을 받아 **최근 DART 공시를 사실 중립 요약**으로 반환하는 MCP 서버(stdio).

기존 웹앱과 동일한 DART 연동 규칙을 따른다: 정형 API가 있는 유형(자기주식취득결정·유상증자결정)은 실제 수치를 넣고, 없는 유형은 목록 정보 + 원문 링크로 처리하며 수치를 지어내지 않는다. 전망·평가·매매의견은 포함하지 않는다(프로젝트 ADR-0003).

## 도구

| 도구 | 설명 |
| --- | --- |
| `dart_summarize_recent_disclosures` | 회사명(또는 6자리 종목코드) + 기간(today/week/month)으로 최근 공시를 요약 반환. 회사명이 모호하면 후보 목록을 돌려줌. |
| `dart_find_company` | 회사명 일부로 상장사(회사명·종목코드·corp_code) 검색. |

## 설치 · 빌드

```bash
cd mcp-server
npm install
npm run build      # dist/ 생성
```

## 환경변수

| 이름 | 설명 |
| --- | --- |
| `OPENDART_API_KEY` | OpenDART 인증키(필수). https://opendart.fss.or.kr 에서 발급. 서버 프로세스에서만 사용. |

## 클라이언트 등록 (Claude Desktop / Claude Code 등)

MCP 설정에 stdio 서버로 추가한다:

```json
{
  "mcpServers": {
    "opendart": {
      "command": "node",
      "args": ["C:/Users/user/Desktop/삼성증권-0721/mcp-server/dist/index.js"],
      "env": { "OPENDART_API_KEY": "발급받은_인증키" }
    }
  }
}
```

## 검사 (MCP Inspector)

```bash
OPENDART_API_KEY=... npx @modelcontextprotocol/inspector node dist/index.js
```

## 상장사 색인 갱신

`data/corp-index.json`은 DART 기업개황에서 상장사만 추린 공개 데이터다. 상장사 구성이 바뀌면 갱신:

```bash
OPENDART_API_KEY=... npm run build:corp-index
```

## 사용 예

- "삼성전자 최근 공시 요약해줘" → `dart_summarize_recent_disclosures(company_name="삼성전자")`
- "카카오 이번 달 공시" → `company_name="카카오", period="month"`
- "005930 오늘 공시" → `company_name="005930", period="today"`
