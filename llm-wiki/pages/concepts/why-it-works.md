---
title: 왜 작동하는가 — 부기 부담과 복리
type: concept
tags: [llm, knowledge-management, rationale]
sources: [2026-07-21-karpathy-llm-wiki]
updated: 2026-07-21
---

# 왜 작동하는가

## 부기(bookkeeping) 부담을 LLM이 진다
지식베이스 유지의 고된 부분은 부기다 — 상호참조 갱신, 요약 최신화, 모순 기록, 정합성 유지. **사람은 유지 부담이 가치보다 빨리 커져 위키를 방치**한다. LLM은 지루해하거나 잊지 않으므로 이 부담을 대신 진다.

## 사람은 고수준에 집중
사람은 소스를 큐레이션하고, 분석을 지시하고, 질문하고, 의미를 생각한다. 나머지(잡일)는 LLM이 처리한다 → 역할 분담은 [LLM Wiki 패턴](llm-wiki-pattern.md) 참고.

## 복리 효과
매 상호작용이 위키를 더 풍부하게 만든다. 검색 패턴과 달리 지식이 **축적**되어 소스·질문이 쌓일수록 가치가 커진다.

## 계보
[Vannevar Bush](../entities/vannevar-bush.md)의 [Memex](memex.md)가 풀지 못했던 "유지의 난제"를 LLM이 해결한다.

## Sources
- [LLM Wiki — Karpathy](../../sources/2026-07-21-karpathy-llm-wiki.md)
