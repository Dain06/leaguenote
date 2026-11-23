import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import {
  getMatchResults,
  getStandingsInfo,
  getStandingsRows,
  getTournament,
} from "@/features/tournaments/queries";
import { computeStandings } from "@/features/tournaments/standings";
import { formatKst } from "@/lib/time";

export const metadata: Metadata = { title: "순위표 · 리그노트" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function StandingsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/tournaments/${id}/standings`);

  // 형식이 틀리거나, 없는 대회이거나, 순위표를 볼 수 없는 사용자면 "없음" 화면을 보여 준다.
  if (!UUID_PATTERN.test(id)) notFound();
  const info = await getStandingsInfo(id);
  if (!info) notFound();

  const [rows, results] = await Promise.all([getStandingsRows(id), getMatchResults(id)]);
  const standings = computeStandings(rows);
  // 세부 경기 결과는 참가 팀의 팀원에게만 돌아온다. 같은 시의 다른 사용자에게는 빈 목록이다.
  const isParticipant = results.length > 0 || (await getMyParticipation(id));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Link href="/tournaments" className="text-sm text-black/60 underline dark:text-white/60">
          ← 대회
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {info.city} {info.sport} 순위표
        </h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          대회 시작 {info.starts_on} · 승 3점, 무 1점, 패 0점 (임시 규칙)
        </p>
      </section>

      <section aria-label="순위표" className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="standings">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/15">
              <th className="py-2 pr-2">순위</th>
              <th className="py-2 pr-2">팀</th>
              <th className="py-2 pr-2">경기</th>
              <th className="py-2 pr-2">승</th>
              <th className="py-2 pr-2">무</th>
              <th className="py-2 pr-2">패</th>
              <th className="py-2 pr-2">득실</th>
              <th className="py-2">승점</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.team_id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-2 pr-2">{s.rank}</td>
                <td className="py-2 pr-2 font-medium">{s.team_name}</td>
                <td className="py-2 pr-2">{s.played}</td>
                <td className="py-2 pr-2">{s.won}</td>
                <td className="py-2 pr-2">{s.drawn}</td>
                <td className="py-2 pr-2">{s.lost}</td>
                <td className="py-2 pr-2">
                  {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                </td>
                <td className="py-2 font-semibold">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isParticipant ? (
        <section
          aria-label="경기 결과"
          className="rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h2 className="font-semibold">경기 결과 ({results.length}경기)</h2>
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              아직 입력된 결과가 없습니다.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="results">
              {results.map((r) => (
                <li key={r.request_id}>
                  {r.home_team_name} {r.home_score} : {r.away_score} {r.away_team_name}{" "}
                  <span className="text-black/50 dark:text-white/50">
                    ({formatKst(r.played_at)})
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            세부 경기 결과는 참가 팀에게만 보입니다. 결과 입력은 대회 화면의 경기 일정에서 합니다.
          </p>
        </section>
      ) : (
        <p className="text-xs text-black/50 dark:text-white/50" data-testid="standings-only">
          같은 시의 사용자에게는 순위표만 공개되고, 세부 경기 결과는 참가 팀에게만 보입니다.
        </p>
      )}
    </div>
  );
}

/** 이 대회에 참가하는 팀의 팀원인지 (대회 상세를 읽을 수 있으면 참가 팀) */
async function getMyParticipation(id: string): Promise<boolean> {
  return (await getTournament(id)) !== null;
}

export default function StandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Suspense fallback={null}>
        <StandingsContent params={params} />
      </Suspense>
    </div>
  );
}
