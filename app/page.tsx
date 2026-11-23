import { Suspense } from "react";

import HomeTeams from "@/features/teams/components/HomeTeams";
import { DB_ENV_NAMES, isDbConfigured } from "@/lib/db/config";

// Design Ref: §3.1 `/` 홈 — 내 팀 목록, 다가오는 일정, 알림 개수
// 일정(작업 4번)과 알림(작업 6번 이후)이 만들어지기 전이라 빈 자리만 보여 준다.
const UPCOMING_SECTIONS = [
  { title: "다가오는 일정", empty: "팀에 일정이 등록되면 여기에 보입니다." },
  { title: "알림", empty: "새 알림이 있으면 여기에 개수가 보입니다." },
];

export default function Home() {
  const dbReady = isDbConfigured();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">리그노트</h1>
        <p className="mt-2 text-black/70 dark:text-white/70">
          팀의 일정·출석을 관리하고, 비슷한 동네 팀과 대회를 만드세요.
        </p>
      </section>

      <section
        aria-label="홈 요약"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <article className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <h2 className="font-semibold">내 팀</h2>
          {/* 로그인 상태에 따라 달라지므로 Suspense로 감싸 나머지 화면을 먼저 보여 준다 */}
          <Suspense
            fallback={
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                불러오는 중...
              </p>
            }
          >
            <HomeTeams />
          </Suspense>
        </article>
        {UPCOMING_SECTIONS.map((section) => (
          <article
            key={section.title}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {section.empty}
            </p>
          </article>
        ))}
      </section>

      <section
        aria-label="데이터 저장소 연결 상태"
        className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15"
      >
        <h2 className="font-semibold">데이터 저장소 연결 상태</h2>
        <p className="mt-2" data-testid="db-status">
          {dbReady
            ? "✅ 연결 정보가 준비되었습니다."
            : "⚠️ 연결 정보가 아직 없습니다."}
        </p>
        {!dbReady && (
          <p className="mt-1 text-black/60 dark:text-white/60">
            .env에 {DB_ENV_NAMES.url}와 {DB_ENV_NAMES.anonKey}를 추가하면
            연결됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
