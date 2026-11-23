import type { Metadata } from "next";
import Link from "next/link";

import SignupForm from "@/features/auth/components/SignupForm";

export const metadata: Metadata = { title: "가입 · 리그노트" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">회원가입</h1>
      <SignupForm />
      <p className="text-sm text-black/60 dark:text-white/60">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
