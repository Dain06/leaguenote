import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "탈퇴 완료 · 리그노트" };

export default function WithdrawnPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <h1 className="text-2xl font-bold tracking-tight">탈퇴가 완료되었습니다</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        계정과 개인 정보가 삭제되었습니다. 그동안 이용해 주셔서 감사합니다.
      </p>
      <Link href="/" className="text-sm font-medium underline">
        홈으로
      </Link>
    </div>
  );
}
