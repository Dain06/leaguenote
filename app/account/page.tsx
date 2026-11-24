import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import DeleteAccountForm from "@/features/auth/components/DeleteAccountForm";

export const metadata: Metadata = { title: "내 계정 · 리그노트" };

async function AccountContent() {
  const user = await requireUser("/account");
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">내 계정</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          {user.nickname || "회원"}님 · {user.email}
        </p>
        <p className="mt-1 text-sm">
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
        </p>
      </section>

      <section
        aria-label="계정 탈퇴"
        className="rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <h2 className="font-semibold">계정 탈퇴</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-black/70 dark:text-white/70">
          <li>이메일, 닉네임, 연락처, 거주 지역과 내 출석·참가 응답, 알림은 바로 삭제됩니다.</li>
          <li>팀 일정·회비·경기 결과처럼 팀이 함께 쓰는 기록은 남지만, 작성자 연결은 끊어집니다.</li>
          <li>운영자인 팀에 다른 팀원이 있으면 탈퇴할 수 없습니다. 먼저 팀원을 모두 내보내 주세요.</li>
          <li>운영자인 팀에 나 혼자 남아 있으면 그 팀도 함께 삭제됩니다.</li>
          <li>탈퇴하면 되돌릴 수 없습니다. 같은 이메일로 다시 가입할 수는 있지만 이전 기록은 복구되지 않습니다.</li>
        </ul>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountContent />
    </Suspense>
  );
}
