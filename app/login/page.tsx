import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { safeNextPath } from "@/features/auth/next";
import LoginForm from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "로그인 · 리그노트" };

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  return (
    <>
      <LoginForm next={next} />
      <p className="text-sm text-black/60 dark:text-white/60">
        아직 계정이 없나요?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-medium underline"
        >
          가입하기
        </Link>
      </p>
    </>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
