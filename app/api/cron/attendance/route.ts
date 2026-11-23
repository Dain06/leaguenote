// Design Ref: §6 기술 선택 — 정해진 시각 실행(Supabase 예약 작업)이 5분마다 이 주소를 호출한다.
// 알람시계는 "깨우기"만 하고, 무엇을 할지의 판단은 이 앱 코드가 한다. 규칙 값은 lib/rules.ts 한 곳에만 있다.
//
// 이 주소가 하는 일 (Plan 작업 7번):
//   출석 투표 게시 시각(시작 2시간 전)이 지난 일정마다
//   - 확정된 선수가 있으면 → 선수 모두에게 "출석 투표가 열렸습니다" 알림
//   - 확정된 선수가 없으면 → 팀 운영자에게 "선수가 확정되지 않았습니다" 알림 (PRD M1 규칙)
// 투표 화면 자체는 시각이 되면 알아서 열리므로, 이 호출이 늦어져도 투표에는 영향이 없다.
import { rejectUnlessCronAuthorized } from "@/lib/cron-auth";
import { createAdminDb } from "@/lib/db/admin";
import { formatKst } from "@/lib/time";

// 같은 요청이 여러 번 와도 알림이 중복되지 않도록 일정마다 한 번만 처리한다.
const MAX_EVENTS_PER_RUN = 100;

export async function GET(request: Request) {
  const rejected = rejectUnlessCronAuthorized(request);
  if (rejected) return rejected;

  const db = createAdminDb();
  const now = new Date();

  // 게시 시각이 지났고 아직 알림을 보내지 않은 일정
  const { data: events, error } = await db
    .from("events")
    .select(
      "id, team_id, starts_at, status, attendance_closes_at, teams(name), event_roster(user_id, is_mercenary)",
    )
    .is("attendance_notified_at", null)
    .not("attendance_opens_at", "is", null)
    .lte("attendance_opens_at", now.toISOString())
    .neq("status", "cancelled")
    .limit(MAX_EVENTS_PER_RUN);

  if (error) {
    return Response.json({ error: "일정을 불러오지 못했습니다." }, { status: 500 });
  }

  let playersNotified = 0;
  let operatorsNotified = 0;
  let skippedClosed = 0;

  for (const event of events ?? []) {
    const team = Array.isArray(event.teams) ? event.teams[0] : event.teams;
    const teamName = team?.name ?? "";
    const when = formatKst(event.starts_at);
    const link = `/events/${event.id}`;
    const closed =
      event.attendance_closes_at !== null &&
      new Date(event.attendance_closes_at).getTime() <= now.getTime();

    // 같은 일정을 동시에 처리하는 다른 호출과 겹치지 않도록, 먼저 "처리함" 표시를 선점한다.
    const { data: claimed } = await db
      .from("events")
      .update({ attendance_notified_at: now.toISOString() })
      .eq("id", event.id)
      .is("attendance_notified_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    // 이미 마감된 일정(호출이 많이 늦은 경우)은 알림을 보내지 않고 처리만 마친다.
    if (closed) {
      skippedClosed += 1;
      continue;
    }

    // 용병은 팀 일정 화면을 볼 수 없어 출석 투표 대상이 아니다. 팀원 선수만 알린다.
    const roster = ((event.event_roster ?? []) as {
      user_id: string;
      is_mercenary: boolean;
    }[]).filter((p) => !p.is_mercenary);

    if (roster.length > 0) {
      const rows = roster.map((player) => ({
        user_id: player.user_id,
        kind: "attendance_open",
        message: `${teamName} ${when} 출석 투표가 열렸습니다. 시작 30분 전까지 투표해 주세요.`,
        link,
      }));
      const { error: insertError } = await db.from("notifications").insert(rows);
      if (!insertError) playersNotified += rows.length;
    } else {
      const { data: operators } = await db
        .from("team_members")
        .select("user_id")
        .eq("team_id", event.team_id)
        .eq("role", "operator");
      const rows = (operators ?? []).map((operator) => ({
        user_id: operator.user_id,
        kind: "roster_missing",
        message: `${teamName} ${when} 일정은 출석 투표가 열렸지만 확정된 선수가 없습니다.`,
        link,
      }));
      if (rows.length > 0) {
        const { error: insertError } = await db.from("notifications").insert(rows);
        if (!insertError) operatorsNotified += rows.length;
      }
    }
  }

  return Response.json({
    checkedAt: now.toISOString(),
    events: events?.length ?? 0,
    playersNotified,
    operatorsNotified,
    skippedClosed,
  });
}
