"use client";

// Design Ref: §3.1 `/teams/[id]/dues` — 회비 항목 만들기, 입금 내역 입력 (운영자)
import { useActionState } from "react";

import FormField from "@/features/auth/components/FormField";

import { addDeposit, createDuesItem } from "../actions";

export function DuesItemForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(
    createDuesItem.bind(null, teamId),
    undefined,
  );
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormField
        name="title"
        label="항목 이름"
        placeholder="예: 12월 월회비"
        defaultValue={values?.title}
        errors={errors?.title}
        required
      />
      <FormField
        name="amount"
        label="금액 (원)"
        type="number"
        inputMode="numeric"
        defaultValue={values?.amount}
        errors={errors?.amount}
        required
      />
      <FormField
        name="dueOn"
        label="납부 기한"
        type="date"
        defaultValue={values?.dueOn}
        errors={errors?.dueOn}
        required
      />
      {state?.message && (
        <p
          role={state.done ? "status" : "alert"}
          className={`text-sm ${state.done ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "만드는 중..." : "항목 만들기"}
      </button>
    </form>
  );
}

export function DepositForm({
  teamId,
  itemId,
}: {
  teamId: string;
  itemId: string;
}) {
  const [state, action, pending] = useActionState(
    addDeposit.bind(null, teamId, itemId),
    undefined,
  );
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-32 flex-1">
          <input
            name="depositor"
            placeholder="입금자 닉네임"
            aria-label="입금자 닉네임"
            defaultValue={values?.depositor}
            className="w-full rounded-md border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25"
          />
        </div>
        <div className="w-28">
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            placeholder="금액(원)"
            aria-label="입금 금액"
            defaultValue={values?.amount}
            className="w-full rounded-md border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/20 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/25 dark:hover:bg-white/10"
        >
          {pending ? "추가 중..." : "입금 추가"}
        </button>
      </div>
      {[...(errors?.depositor ?? []), ...(errors?.amount ?? []), ...(state?.message && !state.done ? [state.message] : [])].map(
        (m) => (
          <p key={m} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {m}
          </p>
        ),
      )}
    </form>
  );
}
