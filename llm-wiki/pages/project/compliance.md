---
title: 컴플라이언스 — AI 요약의 규제 경계
type: project
tags: [samsung-securities, compliance, regulation]
sources: [adr-0003]
updated: 2026-07-21
---

# 컴플라이언스 — AI 요약의 규제 경계

대고객 금융 서비스이므로 [공시 요약](domain-model.md)의 AI 층위는 규제 제약을 최우선으로 지킨다.

## 규칙 (ADR-0003)
- **금지**: 전망("상승 예상"), 평가("호재"), 매매의견("매수 기회").
- **허용**: 공시에 적힌 **사실만** 중립 서술.
- **필수 노출**: 각 요약에 면책 문구 + 원문 링크.

## 이유
AI 요약이 자본시장법상 **투자권유·투자자문**으로 오인될 리스크를 차단. 요약 톤이 건조해지는 것을 감수한다.

## 적용 지점
- LLM 프롬프트 설계·검수의 최우선 기준(→ [외부 의존성: Claude](external-dependencies.md)).
- UI: 요약 카드마다 면책 문구·원문 링크 렌더(→ [스펙 User Stories 11·12](../../../docs/specs/관심종목-공시-요약.md)).

## Sources
- [ADR-0003](../../../docs/adr/0003-ai-summary-strict-factual.md)
