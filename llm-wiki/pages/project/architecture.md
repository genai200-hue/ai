---
title: 아키텍처 — 데이터 제공자 seam과 계층
type: project
tags: [samsung-securities, architecture, seam]
sources: [root-claude-md, spec-disclosure-summary, lib-types]
updated: 2026-07-21
---

# 아키텍처

## 단일 저장소 풀스택
Next.js(App Router) + TypeScript. mock 단계는 화면·상태를 클라이언트에서 구성하고, 실데이터 단계에서 서버(Route Handler)·배치 크론을 추가한다.

## 데이터 제공자 seam (핵심)
화면은 mock 모듈을 직접 읽지 않고 **단일 데이터 제공자 인터페이스**만 통해 데이터에 접근한다:

- `getStockMaster()` — [종목 마스터](domain-model.md) 조회
- `getDisclosures(codes, period)` — 관심종목 코드·기간으로 공시 조회

이 seam이 **mock ↔ 실데이터(DART) 교체 지점이자 주요 테스트 지점**이다. mock 구현과 실 DART 구현이 같은 인터페이스를 만족한다. → 근거 [ADR-0001](decisions.md), [스펙 Testing Decisions](../../../docs/specs/관심종목-공시-요약.md).

> ⚠️ 현황: 이 인터페이스는 스펙에 정의됐으나 아직 코드로 존재하지 않는다. 현재 코드엔 `STOCK_MASTER`/`findStock`만 있다([빌드 현황](build-status.md)).

## 상태·요약의 위치
- **상태 저장 = 클라이언트 로컬**: 관심종목·읽음 상태는 localStorage에만. 서버는 개별 사용자를 식별하지 않는다.
- **요약 = 공시 단위**: 사용자 무관하게 공시 단위로 생성·캐시·공유. 무로그인 구조와 정합.
- **생성 = 하이브리드**: 유니버스는 배치, 나머지는 on-demand.

세 가지 모두 [핵심 결정](decisions.md)에 근거한다.

## Sources
- [루트 CLAUDE.md](../../../CLAUDE.md) — 아키텍처 절
- [스펙](../../../docs/specs/관심종목-공시-요약.md) — Implementation/Testing Decisions
- [lib/types.ts](../../../lib/types.ts)
