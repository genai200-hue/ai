# Log — LLM Wiki 활동 기록

append-only. 각 항목은 `## [YYYY-MM-DD] <op> | <제목>` 접두사로 시작한다. op ∈ {bootstrap, ingest, query, lint}.

## [2026-07-21] bootstrap | LLM Wiki 인스턴스화
- `llm-wiki/` 하위에 3계층 구조 구축: `sources/`(원본), `pages/`(위키), [`CLAUDE.md`](CLAUDE.md)(스키마).
- 상시 문서 `index.md`, `log.md` 생성.

## [2026-07-21] ingest | LLM Wiki (Andrej Karpathy)
- 소스 저장: [sources/2026-07-21-karpathy-llm-wiki.md](sources/2026-07-21-karpathy-llm-wiki.md) (gist에서 취득, 불변).
- 생성한 페이지 (9):
  - concepts: llm-wiki-pattern, architecture-three-layers, operations-ingest-query-lint, indexing-and-logging, why-it-works, memex
  - entities: andrej-karpathy, vannevar-bush
  - tools: tooling
- `index.md` 갱신.
- 모순 없음(첫 소스). Karpathy·Bush 엔티티 페이지는 단일 소스 근거임을 명시 — 후속 소스로 확장 대상.

## [2026-07-21] ingest | 저장소 기존 파일 (삼성증권 프로젝트)
- 저장소 내부 소스를 제자리 참조 방식으로 등록(복사 없음): `CONTEXT.md`, 루트 `CLAUDE.md`, `docs/specs/관심종목-공시-요약.md`, `docs/adr/0001~0004`, `lib/types.ts`, `lib/mock/stocks.ts`, `package.json`.
- 스키마([CLAUDE.md](CLAUDE.md)) 갱신: "저장소 내부 소스는 제자리 상대경로 참조" 규약 추가.
- 생성한 페이지 (7, `pages/project/`): overview, domain-model, architecture, decisions, external-dependencies, compliance, build-status.
- 설계 원칙: CONTEXT.md·ADR은 단일 진실이므로 정의를 재작성하지 않고, 파일 간 **관계·의존·흐름**을 잇는 종합 페이지만 생성.
- `index.md` 갱신(Project 섹션 + 내부 소스 목록).
- 모순 없음. ⚠️ 표시 1건: `architecture.md` — 데이터 제공자 seam은 스펙에 정의됐으나 코드 미구현(현황 반영).
