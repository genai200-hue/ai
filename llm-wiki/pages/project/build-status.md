---
title: 빌드 현황 (mock 단계)
type: project
tags: [samsung-securities, status]
sources: [package-json, lib-types, lib-mock-stocks, spec-disclosure-summary]
updated: 2026-07-21
---

# 빌드 현황 (2026-07-21, mock 단계)

## 있는 것
- **프로젝트 설정**: [package.json](../../../package.json)(Next.js 14.2.5 / React 18.3.1 / TS), `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`.
- **도메인 타입**: [lib/types.ts](../../../lib/types.ts) — `Stock`·`Disclosure`·`StructuredField`·`Period`·`ViewMode`.
- **종목 마스터 mock**: [lib/mock/stocks.ts](../../../lib/mock/stocks.ts) — 20종목(KOSPI 15 = 유니버스, KOSDAQ 5), `DEFAULT_WATCHLIST`, `findStock`.

## 아직 없는 것 (다음 작업)
- **공시 mock 데이터**: `lib/mock/disclosures.ts` (요약·구조화 발췌·hoursAgo 포함).
- **데이터 제공자 seam**: `getStockMaster()` / `getDisclosures(codes, period)` — 스펙에 정의됐으나 미구현(→ [아키텍처](architecture.md)).
- **화면**: `app/`(레이아웃·페이지), `components/`(피드·카드·관심종목 관리·기간/보기 토글·면책 문구).
- **로컬 상태 훅**: 관심종목·읽음(NEW) localStorage.
- **테스트**: seam 위 외부 행위 테스트(스펙 Testing Decisions).

## 참고
빌드 순서·범위는 [스펙](../../../docs/specs/관심종목-공시-요약.md)을 따른다. 실데이터·배치·정정공시·중요도는 out of scope(후속).

## Sources
- [package.json](../../../package.json) · [lib/types.ts](../../../lib/types.ts) · [lib/mock/stocks.ts](../../../lib/mock/stocks.ts)
- [스펙](../../../docs/specs/관심종목-공시-요약.md)
