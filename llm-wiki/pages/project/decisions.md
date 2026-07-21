---
title: 핵심 결정 (ADR 종합)
type: project
tags: [samsung-securities, adr, decisions]
sources: [adr-0001, adr-0002, adr-0003, adr-0004]
updated: 2026-07-21
---

# 핵심 결정 (ADR 종합)

되돌리기 어려운 4가지 결정. 원문 ADR이 단일 진실이며, 이 페이지는 서로의 **의존 관계**를 드러낸다.

## ADR-0001 — DART 단일 출처, mock 우선
외부 대고객 웹앱에서 합법·무료인 DART OpenAPI를 유일 외부 출처로. 공시·[종목 마스터](domain-model.md)를 DART에서 얻고, 개발은 mock 우선 후 동일 인터페이스([데이터 제공자 seam](architecture.md)) 뒤에서 교체. 유니버스는 KOSPI200 고정 리스트.
→ [ADR-0001 원문](../../../docs/adr/0001-mock-first-dart-only-source.md)

## ADR-0002 — 무로그인 + 기기 로컬 저장
계정·SSO 없이 관심종목·읽음 상태를 localStorage에만 저장. 개인정보 보관이 사실상 0 → 컴플라이언스 유리, 단 기기 간 동기화 불가. **이 결정 때문에 "인기 종목"을 알 수 없어**, 배치 대상을 시장 기준 유니버스로 정의(→ ADR-0004).
→ [ADR-0002 원문](../../../docs/adr/0002-no-auth-device-local-watchlist.md)

## ADR-0003 — AI 요약은 사실 중립 서술만
전망·평가·매매의견 금지, 면책 문구 + 원문 링크. 자본시장법상 투자권유·자문 오인 차단. → 상세 [컴플라이언스](compliance.md).
→ [ADR-0003 원문](../../../docs/adr/0003-ai-summary-strict-factual.md)

## ADR-0004 — 공시 단위 캐시 + 하이브리드 생성
요약은 사용자 무관 공시 단위로 캐시·공유(무로그인과 정합). 유니버스(KOSPI200)는 배치 사전 요약, 밖은 on-demand. ADR-0002가 낳은 "유니버스" 개념에 의존.
→ [ADR-0004 원문](../../../docs/adr/0004-disclosure-level-cache-hybrid-generation.md)

## 의존 관계 요약
```
ADR-0002 (무로그인) ──"인기종목 불가"──▶ 시장기준 유니버스 ──▶ ADR-0004 (하이브리드 배치)
ADR-0001 (DART/mock) ──────────────────────────────────▶ 데이터 제공자 seam
ADR-0003 (사실요약) ────────────────────────────────────▶ 컴플라이언스 최우선
```
