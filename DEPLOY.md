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
| `SITE_URL` | 이 앱의 공개 주소(예: `https://leaguenote.vercel.app`). 확인 메일의 복귀 주소로 쓰이며, 없으면 요청 헤더로 추정(로컬 개발용). **배포 주소가 정해진 뒤 Production에 직접 등록** (`.env`에는 없음) | 서버 전용 |

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
  # 운영 값은 .env에 PROD_ 접두사로 저장되어 있다 (개발용 값과 섞이지 않게)
  $value = ((Get-Content .env | Where-Object { $_ -like "PROD_$name=*" }) -split '=',2)[1].Trim()
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
   > **현재 상태(2026-11-24):** 시범 운영·심사 동안 운영 프로젝트의 Confirm email을 **꺼 두었습니다**(`mailer_autoconfirm` 켜짐). 가입하면 메일 없이 바로 로그인되며 이메일 본인 확인은 하지 않습니다. 정식 공개 전에는 아래 3번대로 SMTP를 연결하고 Confirm email을 다시 켜세요(대시보드 Authentication → Providers → Email, 또는 `config/auth`의 `mailer_autoconfirm: false`).
3. **메일 발송 한도:** 기본 메일 서버는 시간당 약 2통이라 시범 운영 인원이 가입하기 어렵습니다. 운영 프로젝트는 이메일 확인이 이미 켜져 있으므로 별도 메일 서비스(SMTP)를 연결해야 합니다.
   1. 메일 서비스(예: Resend)에 가입하고, **보내는 도메인(또는 주소)을 인증**한 뒤 SMTP 정보를 받습니다. (이 단계는 직접 하셔야 합니다)
   2. `.env`에 `PROD_SMTP_HOST`, `PROD_SMTP_PORT`, `PROD_SMTP_USER`, `PROD_SMTP_PASS`, `PROD_SMTP_FROM`을 넣습니다. (선택: `PROD_SMTP_SENDER_NAME`, `PROD_EMAIL_RATE_LIMIT`)
   3. 값 점검: `node --env-file=.env scripts/configure-smtp.mjs`
   4. 적용: `node --env-file=.env scripts/configure-smtp.mjs --apply` (운영 프로젝트에만 적용, 값은 출력하지 않음)
   5. 배포 사이트에서 가입 → 확인 메일 수신 → 링크 클릭 → 로그인되는지 확인합니다.

> 개발용(`leaguenote`)과 운영용(`leaguenote-prod`, 2026-11-24 생성, 서울)은 **서로 다른 Supabase 프로젝트**입니다. 운영용에는 마이그레이션 18개가 적용되어 있고 데이터는 비어 있습니다(가상 팀 없음). 운영용 키·비밀번호는 `.env`의 `PROD_` 접두사 값입니다(`PROD_SUPABASE_PROJECT_REF`, `PROD_NEXT_PUBLIC_SUPABASE_URL`, `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PROD_SUPABASE_SERVICE_ROLE_KEY`, `PROD_SUPABASE_DB_PASSWORD`, `PROD_CRON_SECRET`). 새 마이그레이션을 만들면 **두 프로젝트에 모두** 적용해야 합니다.
> 이 4번 설정(이메일 확인·Site URL·Redirect URLs·SMTP)은 **운영용 프로젝트**에 하세요. 개발용에서는 이메일 확인을 켜지 않는 편이 시험에 편합니다.

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
1. ~~개인정보 처리방침·수집 동의·탈퇴 기능~~ — 구현 완료 (`/privacy`, 가입 동의·만 14세 확인 체크, `/account` 계정 탈퇴, `20261124010000_privacy_consent_withdrawal.sql`). **공개 전에 직접 채울 것:** `lib/privacy.ts`의 `PRIVACY_CONTACT`(문의처), 처리방침 문구의 법률 검토, 보관 기간·최소 연령(임시: 탈퇴 시까지, 만 14세)
2. ~~초대 링크 관리와 팀원 내보내기~~ — 구현 완료(위 "이미 고친 것" 참고)
3. **Supabase "Confirm email" 켜기, Redirect URLs 정리** (4번 항목) — 최소 비밀번호 8자는 2026-11-24에 적용 완료. 나머지는 배포 주소가 정해진 뒤 한 번에 바꿉니다(지금 켜면 로컬 시험 가입에 메일이 필요해지고, Site URL이 아직 `http://localhost:3000`입니다)
4. **운영용 Supabase 프로젝트 분리** (Preview 배포에는 관리 키를 넣지 않도록 3번 명령은 Production만 등록하게 이미 고쳤습니다)
5. **요청 횟수 제한(레이트 리밋)과 별도 SMTP** — Vercel WAF 규칙 또는 Upstash 사용 검토
6. 예약 작업 비밀 값을 Supabase Vault로 옮기기, 확인 메일 복귀 주소를 고정 환경 변수로 쓰기(낮음)
7. `npm audit`와 Supabase Security Advisor 실행

## 9. 알려진 한계

- 계정 탈퇴: 다른 팀원이 있는 팀의 운영자는 탈퇴할 수 없고(먼저 팀원을 내보내야 함), 혼자 남은 팀은 탈퇴와 함께 삭제됩니다. 작성자 칸(일정·회비·모집 글 등)은 탈퇴 후 비워집니다.
- 동의 기능 이전에 가입한 계정은 동의 기록(`profiles.consented_at`)이 비어 있습니다. 개발 중 시험 계정뿐이므로 운영 프로젝트에서는 해당 없습니다.

- 푸시·카카오톡 알림은 범위 밖이라 앱 안 알림함만 있습니다.
- 용병은 팀 일정 화면을 볼 수 없어 출석 투표를 하지 않습니다.
- 회비 입금 대조는 닉네임 일치만 보는 참고용이며 최종 확인은 운영자가 합니다.
- 팀을 만든 계정을 지우려면 `teams.created_by`에 연쇄 삭제가 없어 먼저 팀을 정리해야 합니다.
- 개발 서버(`npm run dev`)는 OneDrive 폴더 안에서 `.next` 잠금 오류가 가끔 납니다. `.next` 폴더를 지우고 다시 실행하면 됩니다.
