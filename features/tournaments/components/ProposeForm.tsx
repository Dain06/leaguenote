"use client";

// Design Ref: §3.2 대회 상세 — 일정 조율 요청 [요청 보내기]
import { useActionState } from "react";

import { proposeSchedule } from "../schedule-actions";

export default function ProposeForm({
  tournamentId,
  fromTeamId,
  toTeamId,
  opponentName,
}: {
  tournamentId: string;
  fromTeamId: string;
  toTeamId: string;
  opponentName: string;
}) {
  const [state, action, pending] = useActionState(
    proposeSchedule.bind(null, tournamentId, fromTeamId, toTeamId),
    undefined,
  );

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="datetime-local"
          name="startsAt"
          aria-label={`${opponentName}와 경기할 날짜와 시간 (한국 시간)`}
          required
          className="rounded-md border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25"
        />
        <input
          type="text"
          name="location"
          placeholder="장소"
          aria-label={`${opponentName}와 경기할 장소`}
          maxLength={60}
          required
          className="min-w-0 flex-1 rounded-md border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-1 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "보내는 중..." : "요청 보내기"}
        </button>
      </div>
      {state?.message && (
        <p
          role={state.done ? "status" : "alert"}
          className={`text-xs ${state.done ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
