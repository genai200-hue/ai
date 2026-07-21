# 관심종목 공시 요약

관심종목에 올라온 DART 공시를 핵심 수치·요약과 함께 모아 보는 웹앱.
Next.js(App Router) + TypeScript. 공시는 OpenDART 실데이터.

프로젝트 규칙·용어·결정은 [CLAUDE.md](CLAUDE.md) · [CONTEXT.md](CONTEXT.md) · [docs/adr/](docs/adr/) 참고.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 그리고 OPENDART_API_KEY 값을 채운다
npm run dev                  # http://localhost:3000
```

### 환경변수

| 이름 | 설명 |
| --- | --- |
| `OPENDART_API_KEY` | OpenDART 인증키. https://opendart.fss.or.kr 에서 발급. **서버에서만 사용**(클라이언트 노출 금지). |

`.env.local`은 커밋되지 않는다(gitignore). 키를 소스/커밋에 넣지 말 것.

## 아키텍처 요약

- 브라우저는 DART를 직접 호출할 수 없다(CORS·키 보안) → 서버 라우트 경유.
- 화면(`app/page.tsx`) → `GET /api/disclosures?codes=..&period=..` → `lib/disclosures.ts`(seam) → `lib/dart/*`(OpenDART).
- 정형 수치는 자기주식취득결정·유상증자결정 등 정형 API가 있는 유형만 채운다. 요약은 규칙 기반 사실 서술(LLM 미사용). 자세한 결정은 [ADR-0005](docs/adr/0005-dart-integration-server-route-partial-structured.md).

## Vercel 배포

1. Vercel에서 이 GitHub 저장소를 **Import**한다. 프레임워크는 Next.js로 자동 감지된다.
2. **Project Settings → Environment Variables**에 `OPENDART_API_KEY`를 추가한다(Production/Preview 모두).
   - 로컬 `.env.local`은 배포에 반영되지 않으므로 반드시 Vercel 쪽에 별도 등록해야 한다.
3. Deploy. 서버리스 리전은 국내 지연을 줄이도록 `icn1`(서울)로 고정돼 있다([vercel.json](vercel.json)).
4. 환경변수를 나중에 바꾸면 재배포(Redeploy)해야 반영된다.

> Vercel CLI를 쓰는 경우: `vercel`(프리뷰) / `vercel --prod`(프로덕션). 첫 실행 시 로그인·프로젝트 연결이 필요하며, 환경변수는 `vercel env add OPENDART_API_KEY` 로도 등록할 수 있다.
