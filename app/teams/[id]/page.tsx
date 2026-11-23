import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import EventList from "@/features/events/components/EventList";
import { getTeamUpcomingEvents } from "@/features/events/queries";
import InviteSection from "@/features/teams/components/InviteSection";
import { getRoster, getTeam } from "@/features/teams/queries";

export const metadata: Metadata = { title: "팀 · 리그노트" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function TeamContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/teams/${id}`);

  // 주소가 팀 번호 형식이 아니거나, 없는 팀이거나, 내가 속하지 않은 팀이면 "없음" 화면을 보여 준다.
  if (!UUID_PATTERN.test(id)) notFound();
  const team = await getTeam(id, user.id);
  if (!team) notFound();

  const [roster, events] = await Promise.all([
    getRoster(id),
    getTeamUpcomingEvents(id),
  ]);
  const isOperator = team.myRole === "operator";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
            {isOperator ? "운영자" : "팀원"}
          </span>
        </div>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          {team.sport} · 한 경기 {team.required_players}명 · {team.city}{" "}
          {team.district}
        </p>
      </section>

      <section
        aria-label="일정"
        className="rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">다가오는 일정</h2>
          {isOperator && (
            <Link
              href={`/teams/${id}/events/new`}
              className="text-sm font-medium underline"
            >
              + 일정 만들기
            </Link>
          )}
        </div>
        <div className="mt-2">
          {events.length === 0 ? (
            <p className="text-sm text-black/60 dark:text-white/60">
              예정된 일정이 없습니다.
            </p>
          ) : (
            <EventList events={events} />
          )}
        </div>
      </section>

      <section
        aria-label="팀원"
        className="rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <h2 className="font-semibold">팀원 {roster.length}명</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm" data-testid="roster">
          {roster.map((member) => (
            <li
              key={member.user_id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                <span className="font-medium">{member.nickname}</span>
                {member.role === "operator" && (
                  <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                    운영자
                  </span>
                )}
              </span>
              {member.phone && (
                <span className="text-black/60 dark:text-white/60">
                  {member.phone}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-black/50 dark:text-white/50">
          연락처는 같은 팀 운영자와 본인에게만 보입니다.
        </p>
      </section>

      {isOperator && <InviteSection teamId={id} />}
    </div>
  );
}

export default function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <TeamContent params={params} />
    </Suspense>
  );
}
