// Design Ref: §3.1 `/` 홈 — 내 팀 목록
import Link from "next/link";

import { getCurrentUser } from "@/features/auth/queries";

import { getMyTeams } from "../queries";

export default async function HomeTeams() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        로그인하면 내가 속한 팀이 여기에 보입니다.
      </p>
    );
  }

  const teams = await getMyTeams();

  return (
    <div className="mt-2 flex flex-col gap-3 text-sm">
      {teams.length === 0 ? (
        <p className="text-black/60 dark:text-white/60">
          아직 속한 팀이 없습니다. 팀을 만들거나 초대 링크로 들어오세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="my-teams">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="font-medium">{team.name}</span>
                <span className="text-black/50 dark:text-white/50">
                  {team.sport}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/teams/new" className="font-medium underline">
        + 팀 만들기
      </Link>
    </div>
  );
}
