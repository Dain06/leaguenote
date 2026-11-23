// Design Ref: §3.1 `/teams/[id]` 팀 홈·`/` 홈 — 다가오는 일정 목록
import Link from "next/link";

import { formatKst } from "@/lib/time";

import type { EventSummary } from "../queries";

export const EVENT_TYPE_LABEL: Record<EventSummary["type"], string> = {
  practice: "연습",
  tournament: "대회",
};

export default function EventList({
  events,
}: {
  events: (EventSummary & { team_name?: string })[];
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm" data-testid="event-list">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/events/${event.id}`}
            className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  event.type === "tournament"
                    ? "border-transparent bg-foreground text-background"
                    : "border-black/15 dark:border-white/20"
                }`}
              >
                {EVENT_TYPE_LABEL[event.type]}
              </span>
              <span className="font-medium">{formatKst(event.starts_at)}</span>
              {event.status === "confirmed" && (
                <span className="text-xs text-green-700 dark:text-green-400">
                  선수 확정
                </span>
              )}
            </span>
            <span className="text-black/60 dark:text-white/60">
              {event.team_name ? `${event.team_name} · ` : ""}
              {event.location}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
