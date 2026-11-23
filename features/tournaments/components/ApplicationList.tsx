// Design Ref: §3.3 대회 참가 신청 — 신청 후 상태 표시(매칭 대기 → ...)
import { formatKst } from "@/lib/time";

import { withdrawApplication } from "../actions";
import type { Application, ApplicationStatus } from "../queries";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  waiting: "매칭 대기",
  matched: "매칭됨",
  excluded: "제외",
};

export default function ApplicationList({
  applications,
  operatorTeamIds,
}: {
  applications: Application[];
  operatorTeamIds: Set<string>;
}) {
  if (applications.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60" data-testid="applications-empty">
        아직 신청한 대회가 없습니다.
      </p>
    );
  }

  const now = new Date().getTime();

  return (
    <ul className="flex flex-col gap-3" data-testid="applications">
      {applications.map((a) => {
        const canWithdraw =
          operatorTeamIds.has(a.team_id) &&
          a.status === "waiting" &&
          new Date(a.deadline_at).getTime() > now;
        return (
          <li
            key={a.id}
            className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.team_name}</span>
              <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
                {a.sport}
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                {STATUS_LABEL[a.status]}
              </span>
            </div>
            <p className="text-black/60 dark:text-white/60">
              대회 시작 {a.tournament_starts_on} · 팀 인원 {a.team_size}명 · 팀 경력{" "}
              {a.career_months}개월
            </p>
            <p className="text-black/60 dark:text-white/60">
              신청 마감 {formatKst(a.deadline_at)}
            </p>
            {canWithdraw && (
              <form action={withdrawApplication.bind(null, a.id)}>
                <button
                  type="submit"
                  className="mt-1 rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                >
                  신청 취소
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
