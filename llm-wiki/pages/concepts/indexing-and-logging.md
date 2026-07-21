---
title: 인덱싱과 로깅 (index.md · log.md)
type: concept
tags: [llm, knowledge-management, tooling]
sources: [2026-07-21-karpathy-llm-wiki]
updated: 2026-07-21
---

# 인덱싱과 로깅

[위키 운영](operations-ingest-query-lint.md)을 받치는 두 개의 상시 문서.

## index.md — 카탈로그
위키 전체의 **콘텐츠 지향 카탈로그**. 각 페이지를 링크·한 줄 요약·(선택)메타데이터와 함께 카테고리별로 나열한다. 매 ingest 시 갱신하며, **query 시 LLM이 가장 먼저 읽는** 진입점이다.

## log.md — append-only 기록
ingest·query·lint를 시간순으로 남기는 추가 전용 기록. 각 항목이 일관된 접두사로 시작하면(예: `## [2026-07-21] ingest | 제목`) 간단한 도구로 파싱할 수 있다.

## Sources
- [LLM Wiki — Karpathy](../../sources/2026-07-21-karpathy-llm-wiki.md)
