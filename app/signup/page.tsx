import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { safeNextPath } from "@/features/auth/next";
import SignupForm from "@/features/auth/components/SignupForm";

export const metadata: Metadata = { title: "가입 · 리그노트" };

async function SignupContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  return (
    <>
      <SignupForm next={next} />
      <p className="text-sm text-black/60 dark:text-white/60">
        이미 계정이 있나요?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium underline"
        >
          로그인
        </Link>
      </p>
    </>
  );
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">회원가입</h1>
      <Suspense fallback={null}>
        <SignupContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
