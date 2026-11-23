import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import { EVENT_TYPE_LABEL } from "@/features/events/components/EventList";
import EventAttendance from "@/features/events/components/EventAttendance";
import EventRoster from "@/features/events/components/EventRoster";
import EventSurvey from "@/features/events/components/EventSurvey";
import {
  getEvent,
  getEventAttendance,
  getEventSurvey,
} from "@/features/events/queries";
import { teamMinPlayers } from "@/lib/rules";
import { formatKst } from "@/lib/time";

export const metadata: Metadata = { title: "일정 · 리그노트" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/events/${id}`);

  // 주소가 일정 번호 형식이 아니거나, 없는 일정이거나, 같은 팀이 아니면 "없음" 화면을 보여 준다.
  if (!UUID_PATTERN.test(id)) notFound();
  const event = await getEvent(id);
  if (!event) notFound();
  const [survey, attendance] = await Promise.all([
    getEventSurvey(id),
    getEventAttendance(id),
  ]);

  const minPlayers = teamMinPlayers(event.team.required_players);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Link
          href={`/teams/${event.team_id}`}
          className="text-sm text-black/60 underline dark:text-white/60"
        >
          ← {event.team.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {formatKst(event.starts_at)}
          </h1>
          <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
            {EVENT_TYPE_LABEL[event.type]}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-black/50 dark:text-white/50">장소</dt>
          <dd data-testid="event-location">{event.location}</dd>
          <dt className="text-black/50 dark:text-white/50">종목</dt>
          <dd>{event.team.sport}</dd>
          <dt className="text-black/50 dark:text-white/50">최소 인원</dt>
          <dd data-testid="event-min-players">{minPlayers}명</dd>
        </dl>
      </section>

      <EventSurvey event={event} survey={survey} myUserId={user.id} />
      <EventRoster event={event} survey={survey} myUserId={user.id} />
      <EventAttendance event={event} attendance={attendance} myUserId={user.id} />
    </div>
  );
}

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <EventContent params={params} />
    </Suspense>
  );
}
