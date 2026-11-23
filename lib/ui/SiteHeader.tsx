// Design Ref: §3.1 화면 목록 — 모든 화면 위쪽에 보이는 공통 메뉴
import Link from "next/link";
import { Suspense } from "react";

import AuthMenu from "@/features/auth/components/AuthMenu";

// 아직 만들지 않은 화면은 링크 대신 "준비 중"으로 보여 준다. (작업이 끝나면 href를 채운다)
const MENU_ITEMS: { label: string; href?: string }[] = [
  { label: "홈", href: "/" },
  { label: "일정" },
  { label: "대회" },
  { label: "알림" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav
        aria-label="주요 메뉴"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link href="/" className="text-lg font-bold tracking-tight">
          리그노트
        </Link>
        <div className="flex items-center gap-2">
          <ul className="flex items-center gap-1 text-sm">
            {MENU_ITEMS.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title="준비 중인 메뉴입니다"
                    className="cursor-not-allowed rounded-md px-3 py-2 text-black/40 dark:text-white/40"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {/* 로그인 상태는 요청마다 달라서 Suspense로 감싸 나머지 화면을 먼저 보여 준다 */}
          <Suspense fallback={<span className="px-3 py-2 text-sm">&nbsp;</span>}>
            <AuthMenu />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
