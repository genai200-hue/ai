---
title: LLM Wiki 패턴
type: concept
tags: [llm, knowledge-management, core]
sources: [2026-07-21-karpathy-llm-wiki]
updated: 2026-07-21
---

# LLM Wiki 패턴

LLM이 소스를 읽어 **지속적·상호링크된 마크다운 위키**를 점진적으로 구축·유지하는 지식베이스 패턴. [Andrej Karpathy](../entities/andrej-karpathy.md)가 제안했다.

## 검색(retrieval) vs 축적(accumulation)

- **검색 패턴(기존)**: 파일을 올리면 질의 시점에 관련 청크를 검색해 답을 생성. 매 질문마다 지식을 **처음부터 재발견**하며 아무것도 남지 않는다.
- **축적 패턴(이 위키)**: 소스를 추가하면 LLM이 읽고 핵심을 추출해 기존 위키에 **통합**한다 — 엔티티 페이지 갱신, 요약 개정, 모순 표시. 위키는 **복리로 쌓이는 산출물**이 된다.

## 핵심 차이

상호참조가 존재하고, 모순이 드러나며, 종합이 소비한 모든 것을 반영한다. 소스와 질문이 쌓일수록 위키가 더 풍부해진다. → 왜 지속되는지는 [왜 작동하는가](why-it-works.md) 참고.

## 역할 분담

- **사람**: 소스를 큐레이션하고 탐색·질문하며 의미를 생각한다.
- **LLM**: 요약·상호참조·정합성 유지 같은 잡일을 한다.

## 구조와 운영

- 3계층으로 구성된다 → [3계층 아키텍처](architecture-three-layers.md)
- 세 가지 작업으로 돌아간다 → [Ingest·Query·Lint](operations-ingest-query-lint.md)
- 항해는 인덱스·로그가 받친다 → [인덱싱과 로깅](indexing-and-logging.md)

## 계보

정신적으로 Vannevar Bush의 [Memex](memex.md)(1945)와 닮았다.

## Sources
- [LLM Wiki — Karpathy](../../sources/2026-07-21-karpathy-llm-wiki.md)
