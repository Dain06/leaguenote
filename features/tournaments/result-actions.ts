"use server";

// Design Ref: §4.3 경기 기록·순위 — 참가 팀 운영자가 결과 입력 → 승점 계산 → 순위표
import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/queries";
import { friendlyDbError } from "@/lib/db/errors";
import { createServerDb } from "@/lib/db/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultState = { message?: string; done?: boolean } | undefined;

/** 경기 결과 입력/수정. 권한·경기 시작 여부는 데이터베이스 함수가 확인한다. */
export async function recordResult(
  tournamentId: string,
  requestId: string,
  _prevState: ResultState,
  formData: FormData,
): Promise<ResultState> {
  await requireUser(`/tournaments/${tournamentId}`);
  if (!UUID_PATTERN.test(tournamentId) || !UUID_PATTERN.test(requestId)) {
    return { message: "요청이 올바르지 않습니다." };
  }

  const home = String(formData.get("homeScore") ?? "");
  const away = String(formData.get("awayScore") ?? "");
  if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) {
    return { message: "점수는 0~99 사이의 숫자로 입력해 주세요." };
  }

  const db = await createServerDb();
  const { error } = await db.rpc("record_match_result", {
    p_request_id: requestId,
    p_home_score: Number(home),
    p_away_score: Number(away),
  });
  if (error) return { message: friendlyDbError(error) };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/standings`);
  return { done: true, message: "결과를 저장했습니다." };
}
