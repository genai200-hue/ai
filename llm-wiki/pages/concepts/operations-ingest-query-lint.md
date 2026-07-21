---
title: 운영 — Ingest · Query · Lint
type: concept
tags: [llm, workflow, knowledge-management]
sources: [2026-07-21-karpathy-llm-wiki]
updated: 2026-07-21
---

# 운영: Ingest · Query · Lint

[LLM Wiki](llm-wiki-pattern.md)를 돌리는 세 가지 작업.

## Ingest — 소스 추가
소스를 넣고 처리를 요청한다. LLM은 읽고 → takeaway를 논의하고 → 요약을 쓰고 → [인덱스](indexing-and-logging.md)를 갱신하고 → 관련 엔티티/개념 페이지를 개정하고 → 로그를 추가한다. **한 소스가 10~15개 페이지를 건드릴 수 있다.**

## Query — 질문에 답하기
위키에 질문한다. LLM은 [인덱스](indexing-and-logging.md)를 먼저 읽어 관련 페이지를 찾고, **인용과 함께** 종합한다. 재사용 가치가 있는 답(비교·분석·연결)은 새 위키 페이지로 파일링해 채팅 히스토리로 사라지지 않게 한다.

## Lint — 건강 점검
주기적으로 위키를 점검한다: 모순, 오래된 주장, 고아 페이지, 누락된 상호참조, 데이터 공백. 위키가 커져도 건강을 유지하는 장치다.

## Sources
- [LLM Wiki — Karpathy](../../sources/2026-07-21-karpathy-llm-wiki.md)
