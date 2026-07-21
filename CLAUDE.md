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
  - [0005](docs/adr/0005-dart-integration-server-route-partial-structured.md) DART 실연동: 서버 라우트 + corp_code 매핑 + 부분 정형/규칙 요약

## 프로젝트 개요

- **이름**: 삼성증권-0721 — 관심종목 공시 요약 웹앱
- **상태**: 실데이터 연동 (OpenDART 실공시 목록 + 정형 수치 + 규칙 기반 요약). 종목 마스터는 고정 유니버스(20종목) mock 유지. 원문 파싱·LLM 요약은 미도입(ADR-0005).
- **플랫폼**: 웹앱 (Next.js App Router + TypeScript). 개발 환경은 Windows. 배포는 Vercel(권장 리전 `icn1`).
- **기본 언어**: 한국어 (커밋·문서·주석은 한국어로 작성)

## 개발 명령어

- 실행(개발 서버): `npm run dev`
- 빌드: `npm run build`
- 프로덕션 실행: `npm run start`
- 린트: `npm run lint`

> **환경변수**: `OPENDART_API_KEY` 필요(OpenDART 인증키). 로컬은 `.env.local`, 배포는 Vercel 프로젝트 환경변수에 등록. `.env.local`은 커밋 금지(gitignore). `.env.example` 참고.

> 테스트는 아직 도입 전. 스펙의 Testing Decisions에 따라 데이터 제공자 seam 위에서 외부 행위 위주로 추가 예정.

## 아키텍처

- **단일 저장소 풀스택**: Next.js(App Router) + TypeScript. 화면은 클라이언트(`app/page.tsx`)에서 구성하고, 공시 조회는 서버 Route Handler(`app/api/disclosures`)가 OpenDART를 호출한다. **브라우저는 DART를 직접 호출할 수 없다**(CORS + 키 노출) — 반드시 서버 경유.
- **데이터 제공자 seam (핵심)**: 화면은 데이터 소스를 직접 읽지 않고 `/api/disclosures`(← 서버의 `getDisclosures(codes, period)` in `lib/disclosures.ts`)만 통해 접근한다. **이 seam이 실데이터(DART) 구현 지점이자 주요 테스트 지점.** 새 데이터 접근을 추가할 땐 이 경계를 우회하지 말 것. 종목 마스터는 고정 유니버스라 클라이언트 상수(`lib/mock/stocks.ts`) 유지.
- **DART 연동 범위(ADR-0005)**: `list.json`(공시 목록) + 자기주식취득결정·유상증자결정 정형 API로 실제 수치 결합. 공급계약·잠정실적 등 정형 API가 없는 유형은 목록 정보 + 원문 링크로 처리(수치를 지어내지 않음). 요약은 정형 값·목록 메타에서 **규칙 기반 사실 서술**로 생성(LLM 미사용).
- **요약은 공시 단위**: 요약은 사용자와 무관하게 공시 단위로 생성·재사용된다(무로그인 구조와 정합, ADR-0004).
- **상태 저장은 클라이언트 로컬**: 관심종목·읽음 상태는 localStorage에만 저장. 서버는 개별 사용자를 식별하지 않는다(ADR-0002).
- **디렉터리(현재)**: `app/`(페이지·API 라우트), `lib/types.ts`(도메인 타입), `lib/disclosures.ts`(데이터 제공자 seam), `lib/dart/`(OpenDART 클라이언트·corp_code 매핑·요약 생성), `lib/mock/stocks.ts`(종목 마스터).

## 규칙 및 참고 사항

- **문서 우선**: 요건·용어·결정이 바뀌면 스펙/CONTEXT/ADR을 먼저 갱신하고 코드를 수정. 코드가 문서와 어긋나면 문서 기준으로 맞추거나, 문서를 고쳐야 하는 상황이면 사용자에게 확인.
- **AI 요약 경계 엄수(ADR-0003)**: 전망·평가·매매의견 금지, 사실 중립 서술만. 대고객 금융 서비스의 규제 제약이므로 최우선.
- **용어 일관성**: CONTEXT.md의 canonical 용어 사용. `_Avoid_`에 적힌 표현은 지양.
- `.gitignore`는 Node·Python·Next(`.next/`, `*.tsbuildinfo`) 산출물을 모두 무시. 비밀 정보(`.env`, `.env.*`, `*.pem`, `*.key`)는 커밋 제외. **`OPENDART_API_KEY`는 절대 소스/커밋에 넣지 말 것** — `.env.local`(로컬)·Vercel 환경변수(배포)로만 주입.
