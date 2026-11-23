"use client";

// Design Ref: §3.2 일정 상세 "2) 선수 확정" — 운영자가 참석 의향자 중에서 선수를 고른다
import { useActionState } from "react";

import { confirmRoster } from "../actions";

type Candidate = { userId: string; nickname: string; checked: boolean };

export default function RosterForm({
  eventId,
  candidates,
  hasRoster,
}: {
  eventId: string;
  candidates: Candidate[];
  hasRoster: boolean;
}) {
  const [state, action, pending] = useActionState(
    confirmRoster.bind(null, eventId),
    undefined,
  );

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm text-black/60 dark:text-white/60">
          참석 의향을 남긴 팀원 중에서 선수를 고르세요.
        </legend>
        {candidates.map((candidate) => (
          <label key={candidate.userId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="players"
              value={candidate.userId}
              defaultChecked={candidate.checked}
            />
            {candidate.nickname}
          </label>
        ))}
      </fieldset>

      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state?.savedCount !== undefined && !state.message && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400" data-testid="roster-saved">
          선수 {state.savedCount}명을 확정했습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "확정 중..." : hasRoster ? "선수 다시 확정" : "선수 확정"}
      </button>
    </form>
  );
}
