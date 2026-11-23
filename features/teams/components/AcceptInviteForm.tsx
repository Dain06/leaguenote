"use client";

// Design Ref: §3.1 `/invite/[code]` — 초대 수락
import { useActionState } from "react";

import { acceptInvite } from "../actions";

export default function AcceptInviteForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(
    acceptInvite.bind(null, code),
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "들어가는 중..." : "팀에 들어가기"}
      </button>
    </form>
  );
}
