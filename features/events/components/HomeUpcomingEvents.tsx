// Design Ref: §3.1 `/` 홈 — 다가오는 일정 (내가 속한 모든 팀)
import { getCurrentUser } from "@/features/auth/queries";

import { getMyUpcomingEvents } from "../queries";
import EventList from "./EventList";

export default async function HomeUpcomingEvents() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        로그인하면 팀의 다가오는 일정이 여기에 보입니다.
      </p>
    );
  }

  const events = await getMyUpcomingEvents(5);

  if (events.length === 0) {
    return (
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        팀에 일정이 등록되면 여기에 보입니다.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <EventList events={events.map((e) => ({ ...e, team_name: e.team_name }))} />
    </div>
  );
}
