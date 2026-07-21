---
title: 도구와 기법 (Obsidian · Marp · 검색)
type: tool
tags: [tooling, obsidian, search]
sources: [2026-07-21-karpathy-llm-wiki]
updated: 2026-07-21
---

# 도구와 기법

[LLM Wiki](../concepts/llm-wiki-pattern.md) 운영을 돕는, 모두 **선택적·모듈식** 도구들.

## 소스 수집·표시
- **Obsidian Web Clipper** — 웹 글을 마크다운으로 변환해 [원본 소스](../concepts/architecture-three-layers.md) 계층에 넣는다.
- **이미지 로컬 다운로드** — Obsidian에서 LLM이 이미지를 보고 참조할 수 있게 한다.

## 위키 형태 파악
- **Obsidian 그래프 뷰** — 무엇이 연결됐는지, 어떤 페이지가 허브/고아인지 시각화. [Lint](../concepts/operations-ingest-query-lint.md)에 유용.
- **Dataview** — 페이지 frontmatter를 질의해 동적 테이블 생성.

## 산출·검색
- **Marp** — 마크다운 기반 슬라이드 덱 생성.
- **하이브리드 검색(BM25 + 벡터) + LLM 재랭킹** — 규모가 커질 때 위키 페이지 검색엔진으로 유용. CLI·MCP 서버 형태로 제공.

## 공짜로 얻는 것
- 위키는 **git 저장소** — 버전 이력·협업을 그대로 얻는다.

## Sources
- [LLM Wiki — Karpathy](../../sources/2026-07-21-karpathy-llm-wiki.md)
