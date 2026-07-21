---
title: 외부 의존성 — DART · KOSPI200 · Claude
type: entity
tags: [samsung-securities, external, dart, llm]
sources: [adr-0001, adr-0004, spec-disclosure-summary]
updated: 2026-07-21
---

# 외부 의존성

## DART (금융감독원 전자공시)
- **역할**: 공시 원문·메타데이터 + [종목 마스터](domain-model.md)(기업개황 corpCode)의 **유일 외부 출처**.
- **선택 이유**: 공식·무료라 외부 대고객 웹앱에서 합법적으로 사용 가능(→ [ADR-0001](decisions.md)).
- **현황**: mock 단계에선 미연동. [데이터 제공자 seam](architecture.md) 뒤에서 교체 예정.

## KOSPI200 고정 리스트 (주요 종목 유니버스)
- **역할**: 배치로 미리 요약할 [유니버스](domain-model.md) 정의.
- **주의**: 정기 리밸런싱이 있어 고정 리스트는 **주기적 수동 갱신** 필요.
- 사용자 데이터와 무관하게 결정(→ [ADR-0002/0004](decisions.md)).

## Claude (Anthropic) — 요약 LLM
- **역할**: [공시 요약](domain-model.md)의 AI 3줄 생성.
- **운용**: 대량 공시는 저비용 모델(Haiku), 중요 공시는 상위 모델로 이원화. 정확한 모델 ID·단가는 착수 시 확정.
- **제약**: 사실 중립 서술만 — [컴플라이언스](compliance.md) 준수.
- **현황**: mock 단계에선 더미 요약 텍스트, 실연동 없음.

## Sources
- [ADR-0001](../../../docs/adr/0001-mock-first-dart-only-source.md) · [ADR-0004](../../../docs/adr/0004-disclosure-level-cache-hybrid-generation.md)
- [스펙](../../../docs/specs/관심종목-공시-요약.md) — Implementation Decisions
