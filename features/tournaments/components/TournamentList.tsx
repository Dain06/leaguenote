// Design Ref: §3.1 `/tournaments` — 내 팀이 참가하는 대회 목록
import Link from "next/link";

import { formatKst } from "@/lib/time";

import type { Tournament, TournamentStatus } from "../queries";

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  deciding: "참가 여부 결정 중",
  confirmed: "확정",
  cancelled: "취소",
};

export default function TournamentList({
  tournaments,
}: {
  tournaments: (Tournament & { team_count: number })[];
}) {
  if (tournaments.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60" data-testid="tournaments-empty">
        아직 매칭된 대회가 없습니다. 신청이 마감되면 매칭 결과가 알림으로 도착합니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="tournaments">
      {tournaments.map((t) => (
        <li key={t.id}>
          <Link
            href={`/tournaments/${t.id}`}
            className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {t.city} {t.sport} 대회
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                {TOURNAMENT_STATUS_LABEL[t.status]}
              </span>
            </span>
            <span className="text-black/60 dark:text-white/60">
              대회 시작 {t.starts_on} · 참가 {t.team_count}팀 · 참가 여부 결정{" "}
              {formatKst(t.decision_deadline_at)}까지
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
