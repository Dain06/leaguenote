// Design Ref: §3.3 화면 체크리스트 — 입력칸 아래에 오류 문구를 칸마다 보여 준다.
import type { InputHTMLAttributes } from "react";

type Props = {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export default function FormField({
  name,
  label,
  errors,
  hint,
  ...inputProps
}: Props) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? errorId : undefined}
        className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
        {...inputProps}
      />
      {hint && !errors?.length && (
        <p className="text-xs text-black/50 dark:text-white/50">{hint}</p>
      )}
      {errors?.map((message) => (
        <p key={message} id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {message}
        </p>
      ))}
    </div>
  );
}
