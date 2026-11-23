// Design Ref: §2 구조 선택 — 앱 안 알림 만들기 (푸시·카카오톡 같은 외부 알림은 범위 밖, PRD 6번)
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationInput = {
  /** 알림 종류 (예: roster_short = 확정 인원 미달) */
  kind: string;
  /** 알림함에 보일 문구 (200자 이하) */
  message: string;
  /** 누르면 이동할 화면 주소 */
  link: string;
};

/**
 * 같은 팀 운영자 모두에게 알림을 남긴다.
 * 이 함수를 부르는 사람이 그 팀의 운영자여야 한다. (데이터베이스 함수가 확인)
 */
export async function notifyTeamOperators(
  db: SupabaseClient,
  teamId: string,
  notification: NotificationInput,
): Promise<void> {
  await db.rpc("notify_team_operators", {
    p_team_id: teamId,
    p_kind: notification.kind,
    p_message: notification.message,
    p_link: notification.link,
  });
}
