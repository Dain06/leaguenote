"use client";

// 계정 탈퇴 — 비밀번호 확인과 안내 확인 체크가 있어야 진행된다.
import { useActionState } from "react";

import { deleteAccount } from "../account-actions";
import FormField from "./FormField";

export default function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const errors = state?.errors;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField
        name="password"
        label="비밀번호 확인"
        type="password"
        autoComplete="current-password"
        errors={errors?.password}
        required
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" className="mt-1" />
          <span>위 내용을 확인했고, 탈퇴하면 되돌릴 수 없다는 것을 이해합니다.</span>
        </label>
        {errors?.confirm?.map((message) => (
          <p key={message} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {message}
          </p>
        ))}
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? "처리 중..." : "계정 탈퇴"}
      </button>
    </form>
  );
}
