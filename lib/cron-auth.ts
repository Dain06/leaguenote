// Design Ref: §6 기술 선택 — 예약 작업이 부르는 주소(/api/cron/...)는 비밀 값(CRON_SECRET)을 아는 호출만 받는다.
import { timingSafeEqual } from "node:crypto";

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 예약 작업 주소의 맨 앞에서 부른다. 허용되지 않으면 돌려줄 응답(503/401)을, 허용되면 null을 돌려준다.
 *  - CRON_SECRET이 설정돼 있지 않으면 503, 값이 틀리거나 없으면 401
 */
export function rejectUnlessCronAuthorized(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET이 설정되지 않았습니다." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, secret)) {
    return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 401 });
  }
  return null;
}
