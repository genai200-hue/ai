---
title: 3계층 아키텍처 (원본 소스 · 위키 · 스키마)
type: concept
tags: [llm, architecture, knowledge-management]
sources: [2026-07-21-karpathy-llm-wiki]
updated: 2026-07-21
---

# 3계층 아키텍처

[LLM Wiki 패턴](llm-wiki-pattern.md)은 세 계층으로 구성된다.

## 1. 원본 소스 (Raw sources)
불변의 큐레이션된 문서 — 글·논문·이미지·데이터. LLM은 **읽되 절대 수정하지 않는다.** 위키의 모든 주장이 거슬러 올라가는 근거지다.

## 2. 위키 (The wiki)
LLM이 생성한 마크다운 — 요약·엔티티·개념 페이지. LLM이 이 계층을 **전적으로 소유**하며, 페이지를 만들고 갱신하고 상호참조를 유지한다.

## 3. 스키마 (The schema)
위키의 구조·규약·워크플로우(ingest/query/maintenance)를 LLM에 알려주는 문서. 흔히 `CLAUDE.md`로 둔다. **위키와 함께 진화(co-evolve)** 시킨다.

> 이 저장소에서의 인스턴스화: 1계층=`sources/`, 2계층=`pages/`, 3계층=[`llm-wiki/CLAUDE.md`](../../CLAUDE.md).

## Sources
- [LLM Wiki — Karpathy](../../sources/2026-07-21-karpathy-llm-wiki.md)
