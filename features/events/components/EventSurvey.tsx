// Design Ref: §3.2 일정 상세 "1) 지원자 조사" — 참석 의향 집계, 내 응답 버튼, 응답 현황
import { attendancePollOpensAt, isSurveyOpen, teamMinPlayers } from "@/lib/rules";
import { formatKst } from "@/lib/time";

import { respondToEvent } from "../actions";
import type { EventWithTeam, SurveyMember } from "../queries";

const buttonBase =
  "rounded-md border px-4 py-2 text-sm font-medium transition-colors";

function NameList({ title, members }: { title: string; members: SurveyMember[] }) {
  return (
    <div>
      <dt className="text-black/50 dark:text-white/50">
        {title} {members.length}명
      </dt>
      <dd className="mt-0.5">
        {members.length === 0 ? "-" : members.map((m) => m.nickname).join(", ")}
      </dd>
    </div>
  );
}

export default function EventSurvey({
  event,
  survey,
  myUserId,
}: {
  event: EventWithTeam;
  survey: SurveyMember[];
  myUserId: string;
}) {
  const attending = survey.filter((m) => m.response === "attend");
  const absent = survey.filter((m) => m.response === "absent");
  const pending = survey.filter((m) => m.response === null);
  const mine = survey.find((m) => m.user_id === myUserId)?.response ?? null;

  const minPlayers = teamMinPlayers(event.team.required_players);
  const shortBy = Math.max(0, minPlayers - attending.length);
  const open = event.status !== "cancelled" && isSurveyOpen(event.starts_at);
  const deadline = formatKst(attendancePollOpensAt(event.starts_at));

  return (
    <section
      aria-label="지원자 조사"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">1) 지원자 조사</h2>

      <p className="mt-2 text-sm" data-testid="survey-summary">
        참석 의향 <strong>{attending.length}명</strong> / 최소 {minPlayers}명
        {shortBy > 0 ? ` (${shortBy}명 더 필요)` : " (최소 인원을 채웠습니다)"}
      </p>

      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <form action={respondToEvent.bind(null, event.id, "attend")}>
              <button
                type="submit"
                aria-pressed={mine === "attend"}
                className={`${buttonBase} ${
                  mine === "attend"
                    ? "border-transparent bg-foreground text-background"
                    : "border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                }`}
              >
                참석
              </button>
            </form>
            <form action={respondToEvent.bind(null, event.id, "absent")}>
              <button
                type="submit"
                aria-pressed={mine === "absent"}
                className={`${buttonBase} ${
                  mine === "absent"
                    ? "border-transparent bg-foreground text-background"
                    : "border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                }`}
              >
                불참
              </button>
            </form>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50" data-testid="survey-my-response">
            내 응답: {mine === "attend" ? "참석" : mine === "absent" ? "불참" : "아직 없음"} ·
            {" "}
            {deadline}까지 바꿀 수 있습니다.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-black/60 dark:text-white/60" data-testid="survey-closed">
          {event.status === "cancelled"
            ? "취소된 일정입니다."
            : `조사가 마감되었습니다. (출석 투표가 게시되는 ${deadline} 전까지 받습니다.)`}
          {" "}
          내 응답: {mine === "attend" ? "참석" : mine === "absent" ? "불참" : "없음"}
        </p>
      )}

      <dl className="mt-4 grid gap-3 text-sm" data-testid="survey-lists">
        <NameList title="참석" members={attending} />
        <NameList title="불참" members={absent} />
        <NameList title="미응답" members={pending} />
      </dl>
    </section>
  );
}
