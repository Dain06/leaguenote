// Design Ref: §6 기술 선택 — 예약 작업이 5분마다 이 주소를 호출한다. (Plan 작업 11번)
// 참가 여부 결정 기한(신청 마감 +3일)이 지난 대회를 확정하거나 취소한다.
import { rejectUnlessCronAuthorized } from "@/lib/cron-auth";
import { createAdminDb } from "@/lib/db/admin";
import { runDecisions, runScheduleClosing } from "@/features/tournaments/run-decisions";

export async function GET(request: Request) {
  const rejected = rejectUnlessCronAuthorized(request);
  if (rejected) return rejected;

  try {
    const db = createAdminDb();
    const now = new Date();
    // 1) 참가 여부 결정 기한 처리 → 2) 경기 일정 조율 기한이 지난 대회의 "미합의" 알림
    const decisions = await runDecisions(db, now);
    const scheduleClosing = await runScheduleClosing(db, now);
    return Response.json({ ...decisions, scheduleClosing });
  } catch {
    return Response.json({ error: "대회 단계 처리를 실행하지 못했습니다." }, { status: 500 });
  }
}
