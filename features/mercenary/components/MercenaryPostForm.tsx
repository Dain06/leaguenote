"use client";

// Design Ref: §3.1 `/events/[id]/mercenary` — 용병 모집 글 올리기(필요 인원)
import { useActionState } from "react";

import { createMercenaryPost } from "../actions";

export default function MercenaryPostForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(
    createMercenaryPost.bind(null, eventId),
    undefined,
  );

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="neededCount">필요 인원</label>
        <input
          id="neededCount"
          name="neededCount"
          type="number"
          min={1}
          max={10}
          defaultValue={1}
          className="w-16 rounded-md border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        />
        <span>명</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-1 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "올리는 중..." : "용병 모집 글 올리기"}
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
