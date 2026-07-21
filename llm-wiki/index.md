# Index — LLM Wiki 카탈로그

위키 전체 페이지의 콘텐츠 지향 카탈로그. **질의(query) 시 여기부터 읽어** 관련 페이지를 찾는다. 매 [ingest](pages/concepts/operations-ingest-query-lint.md) 시 갱신한다.

운영 규칙은 [스키마(CLAUDE.md)](CLAUDE.md), 활동 기록은 [log.md](log.md) 참고.

## Project — 삼성증권 관심종목 공시 요약
- [프로젝트 개요](pages/project/overview.md) — 무엇을 만드는가 + 지식 허브 **(여기부터 시작)**
- [도메인 모델](pages/project/domain-model.md) — 관심종목·공시·요약·유니버스·종목 마스터의 관계와 흐름
- [아키텍처](pages/project/architecture.md) — 데이터 제공자 seam(getStockMaster/getDisclosures), mock↔DART 교체
- [핵심 결정 (ADR 종합)](pages/project/decisions.md) — 4개 ADR과 그 의존 관계
- [외부 의존성](pages/project/external-dependencies.md) — DART · KOSPI200 유니버스 · Claude LLM
- [컴플라이언스](pages/project/compliance.md) — AI 요약의 규제 경계(사실 요약만)
- [빌드 현황](pages/project/build-status.md) — 있는 것 / 남은 것 (mock 단계)

## Concepts (LLM Wiki 방법론)
- [LLM Wiki 패턴](pages/concepts/llm-wiki-pattern.md) — 검색 대신 축적하는 지식베이스 패턴(핵심 개념)
- [3계층 아키텍처](pages/concepts/architecture-three-layers.md) — 원본 소스 · 위키 · 스키마
- [운영: Ingest·Query·Lint](pages/concepts/operations-ingest-query-lint.md) — 위키를 돌리는 세 가지 작업
- [인덱싱과 로깅](pages/concepts/indexing-and-logging.md) — index.md · log.md의 역할
- [왜 작동하는가](pages/concepts/why-it-works.md) — 부기 부담을 LLM이 지고, 지식이 복리로 쌓임
- [Memex (1945)](pages/concepts/memex.md) — LLM Wiki의 지적 계보

## Entities
- [Andrej Karpathy](pages/entities/andrej-karpathy.md) — LLM Wiki 패턴 제안자
- [Vannevar Bush](pages/entities/vannevar-bush.md) — Memex(1945) 구상자

## Tools
- [도구와 기법](pages/tools/tooling.md) — Obsidian·Marp·Dataview·하이브리드 검색·git

## Sources

### 외부 소스 (`sources/`)
- [LLM Wiki — Karpathy (2026-07-21)](sources/2026-07-21-karpathy-llm-wiki.md) — 위키 패턴(방법론)의 출처

### 저장소 내부 소스 (제자리 참조, 불변)
- [CONTEXT.md](../CONTEXT.md) — 도메인 용어집(단일 진실)
- [루트 CLAUDE.md](../CLAUDE.md) — 프로젝트 지침
- [docs/specs/관심종목-공시-요약.md](../docs/specs/관심종목-공시-요약.md) — 스펙(PRD)
- [docs/adr/0001~0004](../docs/adr/) — 핵심 결정
- [lib/types.ts](../lib/types.ts) · [lib/mock/stocks.ts](../lib/mock/stocks.ts) · [package.json](../package.json) — 코드/설정
