# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 작업 전 필독 — 참고 문서

이 프로젝트의 요건·용어·핵심 결정은 아래 문서에 정리돼 있습니다. **모든 작업(설계·구현·리뷰) 전에 반드시 참고**하고, 이 문서들과 어긋나지 않게 진행하세요. 새 결정이 생기면 이 문서들을 먼저 갱신한 뒤 코드를 씁니다.

- **스펙(PRD)**: [docs/specs/관심종목-공시-요약.md](docs/specs/관심종목-공시-요약.md) — 문제·해결·유저스토리·구현/테스트 결정·범위. **기능 작업의 기준 문서.**
- **용어집**: [CONTEXT.md](CONTEXT.md) — 도메인 언어(관심종목, 공시, 공시 요약, 주요 종목 유니버스, 종목 마스터). 코드·문서·커밋에서 이 용어를 그대로 사용.
- **ADR**: [docs/adr/](docs/adr/) — 되돌리기 어려운 결정. 해당 영역을 건드릴 땐 존중할 것.
  - [0001](docs/adr/0001-mock-first-dart-only-source.md) 공시는 DART 단일 출처, mock 우선 개발
  - [0002](docs/adr/0002-no-auth-device-local-watchlist.md) 로그인 없이 관심종목을 기기 로컬(localStorage) 저장
  - [0003](docs/adr/0003-ai-summary-strict-factual.md) AI 요약은 사실 중립 서술만(엄격) + 면책 문구 + 원문 링크
  - [0004](docs/adr/0004-disclosure-level-cache-hybrid-generation.md) 요약은 공시 단위 캐시 + 하이브리드 생성

## 프로젝트 개요

- **이름**: 삼성증권-0721 — 관심종목 공시 요약 웹앱
- **상태**: mock 단계 (더미 데이터 기반 화면 구축 중). 이후 실데이터(DART) 연동.
- **플랫폼**: 웹앱 (Next.js App Router + TypeScript). 개발 환경은 Windows.
- **기본 언어**: 한국어 (커밋·문서·주석은 한국어로 작성)

## 개발 명령어

- 실행(개발 서버): `npm run dev`
- 빌드: `npm run build`
- 프로덕션 실행: `npm run start`
- 린트: `npm run lint`

> 테스트는 아직 도입 전. 스펙의 Testing Decisions에 따라 데이터 제공자 seam 위에서 외부 행위 위주로 추가 예정.

## 아키텍처

- **단일 저장소 풀스택**: Next.js(App Router) + TypeScript. mock 단계에서는 화면·상태를 클라이언트에서 구성하고, 실데이터 단계에서 서버(Route Handler)·배치 크론을 추가.
- **데이터 제공자 seam (핵심)**: 화면은 mock 모듈을 직접 읽지 않고, 단일 데이터 제공자 인터페이스(`getStockMaster()`, `getDisclosures(codes, period)`)만 통해 데이터에 접근한다. **이 seam이 mock↔실데이터(DART) 교체 지점이자 주요 테스트 지점.** 새 데이터 접근을 추가할 땐 이 경계를 우회하지 말 것.
- **요약은 공시 단위**: 요약은 사용자와 무관하게 공시 단위로 생성·캐시되어 재사용된다(무로그인 구조와 정합, ADR-0004).
- **상태 저장은 클라이언트 로컬**: 관심종목·읽음 상태는 localStorage에만 저장. 서버는 개별 사용자를 식별하지 않는다(ADR-0002).
- **디렉터리(현재)**: `app/`(라우트·페이지), `components/`(화면), `lib/types.ts`(도메인 타입), `lib/mock/`(더미 데이터 — 실데이터로 교체 대상).

## 규칙 및 참고 사항

- **문서 우선**: 요건·용어·결정이 바뀌면 스펙/CONTEXT/ADR을 먼저 갱신하고 코드를 수정. 코드가 문서와 어긋나면 문서 기준으로 맞추거나, 문서를 고쳐야 하는 상황이면 사용자에게 확인.
- **AI 요약 경계 엄수(ADR-0003)**: 전망·평가·매매의견 금지, 사실 중립 서술만. 대고객 금융 서비스의 규제 제약이므로 최우선.
- **용어 일관성**: CONTEXT.md의 canonical 용어 사용. `_Avoid_`에 적힌 표현은 지양.
- `.gitignore`는 Node·Python 산출물을 모두 무시. 비밀 정보(`.env`, `*.pem`, `*.key`)는 커밋 제외.
