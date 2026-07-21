---
title: 삼성증권 관심종목 공시 요약 — 프로젝트 개요
type: project
tags: [samsung-securities, disclosure, overview, hub]
sources: [root-claude-md, spec-disclosure-summary]
updated: 2026-07-21
---

# 관심종목 공시 요약 — 프로젝트 개요

개인투자자가 등록한 관심종목의 최근 공시를 모아, **구조화 발췌 + AI 사실요약**으로 압축해 보여주는 웹앱. 이 페이지는 프로젝트 지식의 허브다.

- **한 줄 정의**: "내 관심종목에 최근 무슨 공시가 떴는지" 빠르게 훑는 대고객 웹 서비스.
- **현재 단계**: mock(더미 데이터) 단계 — 화면 구축 중. 이후 실데이터(DART) 연동. → [빌드 현황](build-status.md)
- **스택**: Next.js(App Router) + TypeScript 풀스택 단일 저장소.

## 지식 지도

- [도메인 모델](domain-model.md) — 관심종목·공시·공시 요약·유니버스·종목 마스터의 관계
- [아키텍처](architecture.md) — 데이터 제공자 seam, mock↔DART 교체, 클라이언트 로컬 상태
- [핵심 결정 (ADR)](decisions.md) — 되돌리기 어려운 4가지 결정
- [외부 의존성](external-dependencies.md) — DART · KOSPI200 유니버스 · Claude LLM
- [컴플라이언스](compliance.md) — AI 요약의 규제 경계(사실 요약만)
- [빌드 현황](build-status.md) — 무엇이 있고 무엇이 남았는가

## 방법론
이 위키 자체는 [LLM Wiki 패턴](../concepts/llm-wiki-pattern.md)으로 유지된다.

## Sources
- [루트 CLAUDE.md](../../../CLAUDE.md) — 프로젝트 지침
- [스펙: 관심종목 공시 요약](../../../docs/specs/관심종목-공시-요약.md) — PRD
