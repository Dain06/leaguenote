// Design Ref: §6 기술 선택 — 예약 작업이 5분마다 이 주소를 호출한다. (Plan 작업 10번)
// 신청 마감이 지난 대회 참가 신청을 같은 종목·같은 시로 묶어 대회를 만든다. 무엇을 할지는 앱 코드가 정한다.
import { rejectUnlessCronAuthorized } from "@/lib/cron-auth";
import { createAdminDb } from "@/lib/db/admin";
import { runMatching } from "@/features/tournaments/run-matching";

export async function GET(request: Request) {
  const rejected = rejectUnlessCronAuthorized(request);
  if (rejected) return rejected;

  try {
    return Response.json(await runMatching(createAdminDb(), new Date()));
  } catch {
    return Response.json({ error: "매칭을 실행하지 못했습니다." }, { status: 500 });
  }
}
