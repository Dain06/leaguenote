// Design Ref: §3.2 일정 상세 "2) 선수 확정" — 확정 선수 현황, 최소 인원 비교, 운영자의 확정 폼
import { attendancePollOpensAt, isSurveyOpen, teamMinPlayers } from "@/lib/rules";
import { formatKst } from "@/lib/time";

import type { EventWithTeam, SurveyMember } from "../queries";
import RosterForm from "./RosterForm";

export default function EventRoster({
  event,
  survey,
  myUserId,
  mercenaryCount = 0,
}: {
  event: EventWithTeam;
  survey: SurveyMember[];
  myUserId: string;
  /** 수락된 용병 수 (최소 인원 계산에 포함된다) */
  mercenaryCount?: number;
}) {
  const isOperator = survey.find((m) => m.user_id === myUserId)?.role === "operator";
  const confirmed = survey.filter((m) => m.confirmed);
  const attendees = survey.filter((m) => m.response === "attend");

  const minPlayers = teamMinPlayers(event.team.required_players);
  const open = event.status !== "cancelled" && isSurveyOpen(event.starts_at);
  const deadline = formatKst(attendancePollOpensAt(event.starts_at));
  const total = confirmed.length + mercenaryCount;
  const short = total > 0 && total < minPlayers;

  return (
    <section
      aria-label="선수 확정"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">2) 선수 확정</h2>

      <p className="mt-2 text-sm" data-testid="roster-summary">
        확정 선수 <strong>{confirmed.length}명</strong>
        {mercenaryCount > 0 && <> + 용병 {mercenaryCount}명</>} / 최소 {minPlayers}명
      </p>
      {confirmed.length > 0 && (
        <p className="mt-1 text-sm" data-testid="roster-names">
          {confirmed.map((m) => m.nickname).join(", ")}
        </p>
      )}
      {short && isOperator && (
        <p
          role="alert"
          data-testid="roster-short-warning"
          className="mt-2 text-sm text-amber-700 dark:text-amber-400"
        >
          확정 인원({total}명)이 최소 인원({minPlayers}명)보다 적습니다. 운영자 알림을 남겼습니다.
        </p>
      )}

      {isOperator && open && (
        <>
          {attendees.length === 0 ? (
            <p className="mt-3 text-sm text-black/60 dark:text-white/60">
              아직 참석 의향을 남긴 팀원이 없어 선수를 확정할 수 없습니다.
            </p>
          ) : (
            <RosterForm
              eventId={event.id}
              hasRoster={confirmed.length > 0}
              candidates={attendees.map((m) => ({
                userId: m.user_id,
                nickname: m.nickname,
                // 처음에는 참석 의향자 모두를 선택해 두고, 이미 확정했다면 확정된 선수만 선택해 둔다.
                checked: confirmed.length > 0 ? m.confirmed : true,
              }))}
            />
          )}
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            {deadline}(출석 투표 게시)까지 확정하거나 바꿀 수 있습니다.
          </p>
        </>
      )}

      {!(isOperator && open) && confirmed.length === 0 && (
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          {open
            ? "아직 운영자가 선수를 확정하지 않았습니다."
            : "확정된 선수가 없습니다."}
        </p>
      )}
      {isOperator && !open && event.status !== "cancelled" && (
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          선수 확정이 마감되었습니다. (출석 투표가 게시되는 {deadline} 전까지 가능)
        </p>
      )}
    </section>
  );
}
