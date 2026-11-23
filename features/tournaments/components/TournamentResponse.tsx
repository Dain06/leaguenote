// Design Ref: §3.2 대회 상세 — [참가] [불참] 버튼(우리 팀 팀원)과 응답 현황. 참가 여부 결정은 최대 3일.
import { formatKst } from "@/lib/time";

import { respondTournament } from "../actions";
import type { Participant, ResponseSummary, Tournament } from "../queries";

const buttonBase =
  "rounded-md border px-4 py-2 text-sm font-medium transition-colors";

export default function TournamentResponse({
  tournament,
  participants,
  summary,
  myResponse,
}: {
  tournament: Tournament;
  participants: Participant[];
  summary: ResponseSummary[];
  myResponse: "join" | "decline" | null;
}) {
  const now = new Date().getTime();
  const open =
    tournament.status === "deciding" &&
    now < new Date(tournament.decision_deadline_at).getTime();
  const myActiveTeam = participants.some((p) => p.is_mine && p.status === "active");
  const summaryOf = new Map(summary.map((s) => [s.team_id, s]));

  return (
    <section
      aria-label="참가 여부"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">참가 여부 응답</h2>

      {tournament.status === "confirmed" && (
        <p className="mt-2 text-sm" data-testid="tournament-result">
          대회가 확정되었습니다. 응답하지 않은 팀원이 많은 팀은 빠졌습니다.
        </p>
      )}
      {tournament.status === "cancelled" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" data-testid="tournament-result">
          대회가 취소되었습니다. {tournament.cancel_reason}
        </p>
      )}

      {open && myActiveTeam && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <form action={respondTournament.bind(null, tournament.id, "join")}>
              <button
                type="submit"
                aria-pressed={myResponse === "join"}
                className={`${buttonBase} ${
                  myResponse === "join"
                    ? "border-transparent bg-foreground text-background"
                    : "border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                }`}
              >
                참가
              </button>
            </form>
            <form action={respondTournament.bind(null, tournament.id, "decline")}>
              <button
                type="submit"
                aria-pressed={myResponse === "decline"}
                className={`${buttonBase} ${
                  myResponse === "decline"
                    ? "border-transparent bg-foreground text-background"
                    : "border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                }`}
              >
                불참
              </button>
            </form>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50" data-testid="my-response">
            내 응답: {myResponse === "join" ? "참가" : myResponse === "decline" ? "불참" : "아직 없음"} ·{" "}
            {formatKst(tournament.decision_deadline_at)}까지 바꿀 수 있습니다. 모든 팀원이 응답하면 바로 확정됩니다.
          </p>
        </div>
      )}
      {open && !myActiveTeam && (
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          참가 팀의 팀원만 응답할 수 있습니다.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-1 text-sm" data-testid="response-status">
        {participants.map((p) => {
          const s = summaryOf.get(p.team_id);
          return (
            <li key={p.team_id} className="flex flex-wrap gap-x-3">
              <span className="font-medium">{p.team_name}</span>
              <span className="text-black/60 dark:text-white/60">
                {p.status === "cancelled"
                  ? "취소됨"
                  : s
                    ? `응답 ${s.responded_count}/${s.member_count}명 · 참가 ${s.join_count}명`
                    : "-"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
