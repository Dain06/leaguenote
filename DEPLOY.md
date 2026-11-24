# 리그노트 배포 준비 (Plan 작업 18번)

> 이 문서는 Vercel 배포 직전에 따라 할 순서와, 배포 전에 이미 확인한 것을 정리한 것입니다.
> 비밀 값은 이 문서에 적지 않습니다. 값은 `.env`에서만 관리하고, 아래 명령은 값을 화면에 출력하지 않습니다.

## 1. 배포 전에 확인한 것 (2026-11-23)

| 항목 | 결과 |
|------|------|
| `npm run lint` | 오류 없음 |
| `npm run build` | 오류 없음 |
| `npm test` (Vitest) | 48개 통과 (매칭·참가 결정·일정 짝·회비 대조·순위·시각 규칙) |
| 운영 빌드(`npm run start`)에서 전체 화면 순회 | 로그인 후 13개 화면 정상, 없는 주소는 "없음" 화면 |
| 로그인 없이 보호 화면 접근 | 모두 로그인 화면으로 이동 |
| 예약 작업 주소 3개(`/api/cron/*`) | 비밀 값 없이 부르면 401 |
| 비밀 값 노출 검사 | 브라우저용 빌드, 서버 빌드, 커밋 대상 파일, 커밋 기록 전체에서 0건 |
| `NEXT_PUBLIC_` 변수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 두 개뿐 |
| 서버 전용 키를 쓰는 곳 | `lib/db/admin.ts`, `lib/cron-auth.ts` 두 파일뿐 (브라우저 코드에서 불러오지 않음) |
| `.env`·`node_modules`·`trash-can/`·`.bkit/` | `.gitignore`에 등록, 커밋 대상 아님 |
| Vercel 계정 연결 | `VERCEL_TOKEN`으로 로그인 확인됨, 아직 만든 프로젝트 없음 |

## 2. 환경 변수 (Vercel에 등록할 것)

| 이름 | 용도 | 브라우저 공개 |
|------|------|:------------:|
| `NEXT_PUBLIC_SUPABASE_URL` | 데이터 저장소 주소 | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 키 (접근 규칙으로 보호됨) | 공개 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 관리 키 (예약 작업·알림) | **절대 비공개** |
| `CRON_SECRET` | 예약 작업이 앱 주소를 부를 때의 확인용 비밀 값 | **절대 비공개** |

`GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `OPENAI_API_KEY` 등 개발 도구용 값은 Vercel에 등록하지 않습니다.

## 3. Vercel 연결과 배포

> 아래는 외부 서비스에 프로젝트를 만들고 환경 변수를 올리는 작업이라 **실행 전에 한 번 더 확인**합니다.

PowerShell에서 `my-app` 폴더 기준:

```powershell
# 토큰을 환경 변수로만 넘긴다 (화면에 출력하지 않음)
$env:VERCEL_TOKEN = ((Get-Content .env | Where-Object { $_ -like 'VERCEL_TOKEN=*' }) -split '=',2)[1].Trim()
```

```powershell
npx vercel link --yes --project leaguenote
```

환경 변수 4개를 `.env`에서 읽어 등록 (**Production에만**. 서버 관리 키를 Preview에 넣지 않는다 — 8번 보안 점검 참고):

```powershell
foreach ($name in 'NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET') {
  $value = ((Get-Content .env | Where-Object { $_ -like "$name=*" }) -split '=',2)[1].Trim()
  $value | npx vercel env add $name production
}
```

```powershell
npx vercel deploy --prod
```

배포가 끝나면 나오는 주소(예: `https://leaguenote.vercel.app`)를 아래 4·5번에 사용합니다.

## 4. Supabase 설정 (배포 주소가 정해진 뒤)

Supabase 대시보드 → Authentication:

1. **URL Configuration**
   - Site URL: 배포 주소 (`https://…`)
   - Redirect URLs에 `https://<배포 주소>/auth/callback` 추가
2. **Providers → Email → "Confirm email" 켜기** (지금은 개발 편의를 위해 꺼져 있습니다)
   - 켜면 가입 직후 확인 메일이 가고, 링크를 누르면 `/auth/callback`을 거쳐 로그인됩니다. 확인 전 로그인은 안내 문구가 나옵니다.
3. **메일 발송 한도:** 기본 메일 서버는 시간당 발송 수가 매우 적어 시범 운영 인원이 가입하기 어렵습니다. 운영 전에 Authentication → SMTP Settings에서 별도 메일 서비스를 연결하는 것을 권장합니다.

> 참고: 개발용과 운영용이 **같은 Supabase 프로젝트**를 씁니다. 운영 전에 아래 6번처럼 가상 데이터를 지우고, 이메일 확인을 켜면 개발 중 시험 가입도 메일이 필요해집니다. 필요하면 운영용 프로젝트를 새로 만들어 `supabase/migrations/`를 순서대로 적용하세요.

## 5. 예약 작업 설정 (Supabase pg_cron, 배포 후 한 번)

`supabase/cron/schedule-attendance.sql`의 `<배포주소>`와 `<CRON_SECRET>`을 실제 값으로 바꿔 Supabase SQL 편집기에서 한 번 실행합니다.
(이 파일에는 실제 값을 적어 커밋하지 마세요.)

| 작업 이름 | 호출 주소 | 하는 일 |
|-----------|-----------|---------|
| `leaguenote-attendance` | `/api/cron/attendance` | 출석 투표 게시 알림 (시작 2시간 전) |
| `leaguenote-matching` | `/api/cron/matching` | 신청 마감이 지난 대회 참가 신청 매칭 |
| `leaguenote-tournaments` | `/api/cron/tournaments` | 참가 여부 결정 기한 처리(확정·취소), 경기 일정 미합의 알림 |

모두 5분마다 호출합니다(임시). 멈추려면 파일 맨 아래의 `cron.unschedule(...)`을 실행합니다.

## 6. 배포 후 점검 순서

1. 배포 주소 접속 → 홈이 열리는지
2. 회원가입 → (이메일 확인을 켰다면) 메일 링크 → 로그인되는지
3. 팀 만들기 → 초대 링크 → 다른 계정으로 가입·참여
4. 일정 만들기 → 지원자 조사 → 선수 확정 → 출석 투표
5. 예약 작업 주소가 비밀 값으로만 열리는지:
   ```powershell
   curl.exe -i https://<배포 주소>/api/cron/matching
   ```
   → `401`이 나와야 합니다. (비밀 값을 담은 호출은 예약 작업만 합니다.)
6. 가상 데이터 정리 (시험 팀 25개와 가상 운영자 계정):
   ```powershell
   node --env-file=.env scripts/seed-demo-teams.mjs --remove
   ```

## 7. 임시 값·미결정 규칙 (PRD에서 "임시"로 표시된 것)

값은 모두 `lib/rules.ts` 한 곳에 있습니다. 시범 운영 결과를 보고 확정하세요.

- 한 대회 최소 4팀, 팀 인원 차이 최대 3명, 팀 경력 구간(6개월/1년/2년), 같은 시 안에서만 매칭
- 미응답 과반 팀 제외, 남은 팀 4팀 미만이면 대회 취소 (팀 인원은 앱 가입 팀원 수로 계산)
- 승점 승 3·무 1·패 0
- 팀 모집 글 팀당 모집 중 3개까지
- 예약 작업 주기 5분
- **미결정:** 대회 방식(리그전/토너먼트)과 경기 수, 4일 안에 일정이 합의되지 않을 때의 처리(지금은 "미합의" 표시와 알림만), 탈퇴·개인정보 보관 기간

## 8. 보안 점검 결과 (2026-11-24, 보안 전문가 점검)

**이미 고친 것** (`supabase/migrations/20261123150000_security_hardening.sql` 적용, 코드 반영, 시험 완료)
- 로그인 후 이동 주소 검사 강화: 탭·줄바꿈 같은 보이지 않는 문자로 다른 사이트로 보내던 우회 차단 (`features/auth/next.ts`, 시험 `tests/auth-next.test.ts`)
- 용병 글 표 직접 조회 차단(화면은 함수로만 읽음), 팀 모집 글의 작성자 번호 비공개, 소속 확인 함수(`is_team_member_of`) 삭제
- 데이터베이스에서도 확인하도록 변경: 대회 신청 마감(시작 3주 전) 직접 계산과 최소 인원, 참석 의향·선수 확정·용병 수락 시한, 출석 투표 시간, 일정 등록 때 상태·알림 표시·대회 연결 칸 지정 금지
- 가입 정보 형식 제약(닉네임 2~12자, 연락처 형식, 시·도 목록, 시군구 길이)과 프로필 수정 범위 제한(시·도 변경 불가)
- 알림 링크는 앱 안 주소만, 알림 종류는 영문 소문자·밑줄만 허용
- 보안 헤더 추가(`next.config.ts`): 클릭재킹 방지(`X-Frame-Options`, `frame-ancestors`), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS
- 데이터베이스 오류 문구를 그대로 보여 주지 않음(`lib/db/errors.ts`), 용병 수락·거절 때 일정과 글 번호가 맞는지 확인
- 서버 관리 키 파일에 `server-only` 보호 추가(브라우저 코드가 가져오면 빌드 실패)
- 초대 링크 관리와 팀원 내보내기·탈퇴 (`20261123160000_invites_members.sql`): 새 링크를 만들면 이전 링크 즉시 만료, 운영자가 링크 끄기, 링크 하나당 사용 한도 30명(임시), 운영자의 팀원 내보내기와 팀원의 팀 나가기(앞으로 열릴 일정의 참석·출석 기록은 정리, 지난 기록은 유지, 운영자는 내보내거나 나갈 수 없음)

**공개 전에 남은 것** (코드 밖 설정이거나 기능 추가가 필요)
1. **개인정보 처리방침·수집 동의·탈퇴 기능** — 연락처 등을 받으므로 필요합니다. 사용자를 가리키는 칸의 삭제 규칙도 함께 정리해야 계정 삭제가 됩니다. (미구현)
2. ~~초대 링크 관리와 팀원 내보내기~~ — 구현 완료(위 "이미 고친 것" 참고)
3. **Supabase "Confirm email" 켜기, 최소 비밀번호 8자, Redirect URLs 정리** (4번 항목)
4. **운영용 Supabase 프로젝트 분리** (Preview 배포에는 관리 키를 넣지 않도록 3번 명령은 Production만 등록하게 이미 고쳤습니다)
5. **요청 횟수 제한(레이트 리밋)과 별도 SMTP** — Vercel WAF 규칙 또는 Upstash 사용 검토
6. 예약 작업 비밀 값을 Supabase Vault로 옮기기, 확인 메일 복귀 주소를 고정 환경 변수로 쓰기(낮음)
7. `npm audit`와 Supabase Security Advisor 실행

## 9. 알려진 한계

- 푸시·카카오톡 알림은 범위 밖이라 앱 안 알림함만 있습니다.
- 용병은 팀 일정 화면을 볼 수 없어 출석 투표를 하지 않습니다.
- 회비 입금 대조는 닉네임 일치만 보는 참고용이며 최종 확인은 운영자가 합니다.
- 팀을 만든 계정을 지우려면 `teams.created_by`에 연쇄 삭제가 없어 먼저 팀을 정리해야 합니다.
- 개발 서버(`npm run dev`)는 OneDrive 폴더 안에서 `.next` 잠금 오류가 가끔 납니다. `.next` 폴더를 지우고 다시 실행하면 됩니다.
