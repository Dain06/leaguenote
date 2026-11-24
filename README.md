# 리그노트

동호회·사회인 운동 팀의 **일정·출석 관리(M1)** 와 **동네 대회 매칭(M2)** 을 돕는 웹 앱입니다.
Next.js(App Router) + Supabase(로그인·데이터) + Tailwind, 배포는 Vercel을 씁니다.

- **접속 주소:** https://leaguenote.vercel.app
- **저장소:** https://github.com/Dain06/leaguenote
- **시범 운영 안내:** 시범 운영·심사용 배포입니다. 가입은 이메일 확인 없이 바로 되며(본인 확인 없음), 정식 공개 전에 도메인·SMTP 연결과 개인정보 처리방침 문의처·법률 검토가 필요합니다([CHECK.md](CHECK.md) 참고).

## 문서

| 문서 | 내용 |
|------|------|
| [PRD.md](PRD.md) | 무엇을 왜 만드는지 (기준 문서) |
| [PLAN.md](PLAN.md) | 작업 순서와 일정 |
| [DESIGN.md](DESIGN.md) | 화면·데이터·구조 설계 |
| [CLAUDE.md](CLAUDE.md) | 이 프로젝트에서 Claude가 따르는 규칙 |
| [DEPLOY.md](DEPLOY.md) | 배포 전 점검 결과와 Vercel·Supabase 설정 순서 |

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:3000)
npm run lint     # 코드 검사
npm test         # 규칙 시험(Vitest)
npm run build    # 운영 빌드
```

`.env`에 아래 값이 필요합니다(값은 커밋하지 않습니다). 자세한 설명은 [DEPLOY.md](DEPLOY.md)를 보세요.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용
CRON_SECRET=                 # 서버 전용
```

## 폴더

- `app/` 화면(주소별 페이지)과 예약 작업 주소(`app/api/cron/*`)
- `features/` 기능별 폴더: `auth`, `teams`, `events`, `notifications`, `tournaments`, `recruit`, `dues`, `mercenary`
- `lib/` 공통 도구: `rules.ts`(PRD 규칙 값), `time.ts`, `db/`(데이터 저장소 연결)
- `supabase/migrations/` 데이터 구조(순서대로 적용), `supabase/cron/` 예약 작업 설정 틀
- `scripts/seed-demo-teams.mjs` 매칭 점검용 가상 팀 만들기·지우기
- `tests/` 규칙 시험
