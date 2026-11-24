// Design Ref: §3.1 공통 메뉴 — 로그인 전에는 "로그인·가입", 로그인 후에는 닉네임과 "로그아웃"
import Link from "next/link";

import { getUnreadCount } from "@/features/notifications/queries";

import { logout } from "../actions";
import { getCurrentUser } from "../queries";

const itemClass =
  "rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10";

export default async function AuthMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className={itemClass}>
          로그인
        </Link>
        <Link href="/signup" className={itemClass}>
          가입
        </Link>
      </div>
    );
  }

  const unread = await getUnreadCount();

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link href="/notifications" className={itemClass}>
        알림
        {unread > 0 && (
          <span
            data-testid="unread-badge"
            className="ml-1 rounded-full bg-foreground px-1.5 py-0.5 text-xs text-background"
          >
            {unread}
          </span>
        )}
      </Link>
      <span data-testid="current-nickname" className="font-medium">
        {user.nickname || "회원"}님
      </span>
      <Link href="/account" className={itemClass}>
        내 계정
      </Link>
      <form action={logout}>
        <button type="submit" className={itemClass}>
          로그아웃
        </button>
      </form>
    </div>
  );
}
