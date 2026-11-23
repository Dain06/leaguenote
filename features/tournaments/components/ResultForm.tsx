"use client";

// Design Ref: §3.1 `/tournaments/[id]/standings` — 경기 결과 입력(참가 팀 운영자만)
import { useActionState } from "react";

import { recordResult } from "../result-actions";

export default function ResultForm({
  tournamentId,
  requestId,
  homeName,
  awayName,
  initialHome,
  initialAway,
}: {
  tournamentId: string;
  requestId: string;
  homeName: string;
  awayName: string;
  initialHome?: number;
  initialAway?: number;
}) {
  const [state, action, pending] = useActionState(
    recordResult.bind(null, tournamentId, requestId),
    undefined,
  );

  const input =
    "w-16 rounded-md border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25";

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{homeName}</span>
        <input
          name="homeScore"
          type="number"
          min={0}
          max={99}
          defaultValue={initialHome}
          aria-label={`${homeName} 점수`}
          required
          className={input}
        />
        <span>:</span>
        <input
          name="awayScore"
          type="number"
          min={0}
          max={99}
          defaultValue={initialAway}
          aria-label={`${awayName} 점수`}
          required
          className={input}
        />
        <span>{awayName}</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 disabled:opacity-60 dark:border-white/25 dark:hover:bg-white/10"
        >
          {pending ? "저장 중..." : initialHome === undefined ? "결과 입력" : "결과 수정"}
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
