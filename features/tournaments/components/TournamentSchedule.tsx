// Design Ref: §3.2 대회 상세 — 경기 일정 조율(4일). 두 팀 사이 요청을 주고받고, 합의되면 양 팀 일정이 자동으로 생긴다.
import Link from "next/link";

import { formatKst } from "@/lib/time";

import { respondSchedule, withdrawSchedule } from "../schedule-actions";
import { allPairs, pairKey } from "../schedule";
import type { MatchResult, Participant, ScheduleRequest, Tournament } from "../queries";

import ProposeForm from "./ProposeForm";
import ResultForm from "./ResultForm";

const smallButton =
  "rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

export default function TournamentSchedule({
  tournament,
  participants,
  requests,
  operatorTeamIds,
  matchEventIds,
  results,
}: {
  tournament: Tournament;
  participants: Participant[];
  requests: ScheduleRequest[];
  operatorTeamIds: Set<string>;
  matchEventIds: Map<string, string>;
  results: Map<string, MatchResult>;
}) {
  if (tournament.status !== "confirmed") return null;

  const now = new Date().getTime();
  const open = now < new Date(tournament.schedule_deadline_at).getTime();
  const active = participants.filter((p) => p.status === "active");
  const nameOf = new Map(active.map((p) => [p.team_id, p.team_name]));
  const mineIds = new Set(active.filter((p) => p.is_mine).map((p) => p.team_id));

  // 한 짝에 대해 가장 최근의 "열린" 요청(대기·합의)
  const openByPair = new Map<string, ScheduleRequest>();
  for (const r of requests) {
    if (r.status !== "pending" && r.status !== "accepted") continue;
    openByPair.set(pairKey(r.from_team_id, r.to_team_id), r);
  }

  const pairs = allPairs(active.map((p) => p.team_id));
  const myPairs = pairs.filter(([a, b]) => mineIds.has(a) || mineIds.has(b));
  const otherPairs = pairs.filter(([a, b]) => !mineIds.has(a) && !mineIds.has(b));

  return (
    <section
      aria-label="경기 일정"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">경기 일정 조율</h2>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        {open
          ? `${formatKst(tournament.schedule_deadline_at)}까지 두 팀이 경기 일정을 합의해야 합니다. 대회 시작일(${tournament.starts_on}) 이후 시간으로 제안할 수 있고, 합의되면 양 팀 일정이 자동으로 만들어집니다.`
          : "일정 조율 기간이 끝났습니다. 합의되지 않은 경기는 \"미합의\"로 표시됩니다."}
      </p>

      <ul className="mt-3 flex flex-col gap-3 text-sm" data-testid="my-matches">
        {myPairs.map(([a, b]) => {
          const myTeamId = mineIds.has(a) ? a : b;
          const opponentId = myTeamId === a ? b : a;
          const opponent = nameOf.get(opponentId) ?? "";
          const request = openByPair.get(pairKey(a, b));
          const canOperate = operatorTeamIds.has(myTeamId);
          const eventId = request ? matchEventIds.get(request.id) : undefined;

          return (
            <li
              key={pairKey(a, b)}
              className="rounded-md border border-black/10 p-3 dark:border-white/15"
            >
              <p className="font-medium">
                {nameOf.get(myTeamId)} vs {opponent}
              </p>

              {request?.status === "accepted" && (
                <p className="mt-1 text-sm" data-testid="match-agreed">
                  합의됨 · {formatKst(request.proposed_at)} · {request.location}{" "}
                  {eventId && (
                    <Link href={`/events/${eventId}`} className="font-medium underline">
                      일정 보기
                    </Link>
                  )}
                </p>
              )}

              {request?.status === "accepted" && (
                <div data-testid="match-result">
                  {results.get(request.id) ? (
                    <p className="mt-1 text-sm font-medium">
                      결과 {results.get(request.id)!.home_team_name}{" "}
                      {results.get(request.id)!.home_score} :{" "}
                      {results.get(request.id)!.away_score}{" "}
                      {results.get(request.id)!.away_team_name}
                    </p>
                  ) : null}
                  {canOperate && new Date(request.proposed_at).getTime() <= now && (
                    <ResultForm
                      tournamentId={tournament.id}
                      requestId={request.id}
                      homeName={request.from_team_name}
                      awayName={request.to_team_name}
                      initialHome={results.get(request.id)?.home_score}
                      initialAway={results.get(request.id)?.away_score}
                    />
                  )}
                  {!results.get(request.id) &&
                    new Date(request.proposed_at).getTime() > now && (
                      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                        경기가 시작되면 운영자가 결과를 입력할 수 있습니다.
                      </p>
                    )}
                </div>
              )}

              {request?.status === "pending" && request.from_team_id === myTeamId && (
                <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="match-sent">
                  <span>
                    제안함 · {formatKst(request.proposed_at)} · {request.location} · 상대 팀 응답 대기
                  </span>
                  {canOperate && (
                    <form action={withdrawSchedule.bind(null, request.id)}>
                      <button type="submit" className={smallButton}>
                        철회
                      </button>
                    </form>
                  )}
                </div>
              )}

              {request?.status === "pending" && request.to_team_id === myTeamId && (
                <div className="mt-1 flex flex-col gap-2" data-testid="match-received">
                  <span>
                    {request.from_team_name}의 제안 · {formatKst(request.proposed_at)} ·{" "}
                    {request.location}
                  </span>
                  {canOperate ? (
                    <div className="flex gap-2">
                      <form action={respondSchedule.bind(null, request.id, true)}>
                        <button type="submit" className={smallButton}>
                          수락
                        </button>
                      </form>
                      <form action={respondSchedule.bind(null, request.id, false)}>
                        <button type="submit" className={smallButton}>
                          거절
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="text-xs text-black/50 dark:text-white/50">
                      팀 운영자가 수락하거나 거절합니다.
                    </span>
                  )}
                </div>
              )}

              {!request && open && canOperate && (
                <ProposeForm
                  tournamentId={tournament.id}
                  fromTeamId={myTeamId}
                  toTeamId={opponentId}
                  opponentName={opponent}
                />
              )}
              {!request && open && !canOperate && (
                <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                  아직 제안이 없습니다. 팀 운영자가 제안합니다.
                </p>
              )}
              {!request && !open && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400" data-testid="match-unagreed">
                  미합의
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {otherPairs.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-black/60 dark:text-white/60">
            다른 팀의 경기 ({otherPairs.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1" data-testid="other-matches">
            {otherPairs.map(([a, b]) => {
              const request = openByPair.get(pairKey(a, b));
              return (
                <li key={pairKey(a, b)} className="flex flex-wrap gap-x-3">
                  <span>
                    {nameOf.get(a)} vs {nameOf.get(b)}
                  </span>
                  <span className="text-black/60 dark:text-white/60">
                    {request?.status === "accepted"
                      ? `합의됨 · ${formatKst(request.proposed_at)}`
                      : open
                        ? "합의 전"
                        : "미합의"}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
