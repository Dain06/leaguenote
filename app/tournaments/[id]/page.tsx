import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import { TOURNAMENT_STATUS_LABEL } from "@/features/tournaments/components/TournamentList";
import TournamentResponse from "@/features/tournaments/components/TournamentResponse";
import TournamentPractice from "@/features/tournaments/components/TournamentPractice";
import TournamentSchedule from "@/features/tournaments/components/TournamentSchedule";
import {
  getMatchEventIds,
  getMyResponse,
  getOperatorTeams,
  getScheduleRequests,
  getResponseSummary,
  getTournament,
  getTournamentParticipants,
} from "@/features/tournaments/queries";
import { formatKst } from "@/lib/time";

export const metadata: Metadata = { title: "대회 상세 · 리그노트" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function TournamentContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/tournaments/${id}`);

  // 주소가 대회 번호 형식이 아니거나, 없는 대회이거나, 참가 팀이 아니면 "없음" 화면을 보여 준다.
  if (!UUID_PATTERN.test(id)) notFound();
  const tournament = await getTournament(id);
  if (!tournament) notFound();
  const [participants, summary, myResponse, requests, operatorTeams] =
    await Promise.all([
      getTournamentParticipants(id),
      getResponseSummary(id),
      getMyResponse(id, user.id),
      getScheduleRequests(id),
      getOperatorTeams(user.id),
    ]);
  const matchEventIds = await getMatchEventIds(
    requests.filter((r) => r.status === "accepted").map((r) => r.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Link href="/tournaments" className="text-sm text-black/60 underline dark:text-white/60">
          ← 대회
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {tournament.city} {tournament.sport} 대회
          </h1>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
            {TOURNAMENT_STATUS_LABEL[tournament.status]}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-black/50 dark:text-white/50">대회 시작</dt>
          <dd>{tournament.starts_on}</dd>
          <dt className="text-black/50 dark:text-white/50">참가 여부 결정</dt>
          <dd>{formatKst(tournament.decision_deadline_at)}까지 (3일)</dd>
          <dt className="text-black/50 dark:text-white/50">경기 일정 확정</dt>
          <dd>{formatKst(tournament.schedule_deadline_at)}까지 (4일)</dd>
        </dl>
      </section>

      <TournamentResponse
        tournament={tournament}
        participants={participants}
        summary={summary}
        myResponse={myResponse}
      />

      <TournamentSchedule
        tournament={tournament}
        participants={participants}
        requests={requests}
        operatorTeamIds={new Set(operatorTeams.map((t) => t.id))}
        matchEventIds={matchEventIds}
      />

      <TournamentPractice
        tournament={tournament}
        participants={participants}
        operatorTeamIds={new Set(operatorTeams.map((t) => t.id))}
      />

      <section aria-label="참가 팀" className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="font-semibold">참가 팀 ({participants.length}팀)</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm" data-testid="participants">
          {participants.map((p) => (
            <li key={p.team_id} className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">
                {p.team_name}
                {p.is_mine && " (우리 팀)"}
              </span>
              <span className="text-black/60 dark:text-white/60">
                {p.district} · 인원 {p.team_size}명 · 경력 {p.career_months}개월
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Suspense fallback={null}>
        <TournamentContent params={params} />
      </Suspense>
    </div>
  );
}
