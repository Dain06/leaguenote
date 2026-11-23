// Design Ref: §4.2 M2 — [D+7~D+21] 2주간 연습(연습 일정은 M1 기능으로 등록) → 대회 시작
import Link from "next/link";

import type { Participant, Tournament } from "../queries";

export default function TournamentPractice({
  tournament,
  participants,
  operatorTeamIds,
}: {
  tournament: Tournament;
  participants: Participant[];
  operatorTeamIds: Set<string>;
}) {
  if (tournament.status !== "confirmed") return null;

  const myTeams = participants.filter((p) => p.is_mine && p.status === "active");

  return (
    <section
      aria-label="연습"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">대회 전 연습</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60" data-testid="practice-guide">
        경기 일정이 정해지면 대회 시작일({tournament.starts_on})까지 최대 2주 동안 연습합니다.
        연습·모의 모임은 팀 일정으로 등록하고, 지원자 조사·선수 확정·출석 투표도 같은 방식으로
        진행합니다.
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {myTeams.map((team) => (
          <li key={team.team_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{team.team_name}</span>
            <Link href={`/teams/${team.team_id}`} className="underline">
              팀 일정 보기
            </Link>
            {operatorTeamIds.has(team.team_id) && (
              <Link
                href={`/teams/${team.team_id}/events/new`}
                className="font-medium underline"
                data-testid="practice-new-link"
              >
                연습 일정 만들기
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
