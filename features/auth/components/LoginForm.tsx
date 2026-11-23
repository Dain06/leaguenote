"use client";

// Design Ref: §3.1 `/login` — 이메일과 비밀번호로 로그인
import { useActionState } from "react";

import { login } from "../actions";
import FormField from "./FormField";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField
        name="email"
        label="이메일"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
        required
      />
      <FormField
        name="password"
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        errors={state?.errors?.password}
        required
      />

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
        {pending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
