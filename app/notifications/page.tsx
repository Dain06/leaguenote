import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import { markAllNotificationsRead } from "@/features/notifications/actions";
import { getMyNotifications } from "@/features/notifications/queries";
import { formatKst } from "@/lib/time";

export const metadata: Metadata = { title: "알림 · 리그노트" };

async function NotificationsContent() {
  await requireUser("/notifications");
  const items = await getMyNotifications();
  const unread = items.filter((item) => !item.read_at).length;

  if (items.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        아직 받은 알림이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <p data-testid="notifications-unread">
          읽지 않은 알림 <strong>{unread}개</strong>
        </p>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              모두 읽음으로 표시
            </button>
          </form>
        )}
      </div>

      <ul className="flex flex-col gap-2" data-testid="notification-list">
        {items.map((item) => {
          const body = (
            <>
              <span className="flex items-center gap-2">
                {!item.read_at && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                    새 알림
                  </span>
                )}
                <span className="text-xs text-black/50 dark:text-white/50">
                  {formatKst(item.created_at)}
                </span>
              </span>
              <span className="mt-1 block text-sm">{item.message}</span>
            </>
          );
          return (
            <li key={item.id}>
              {item.link ? (
                <Link
                  href={item.link}
                  className="block rounded-lg border border-black/10 p-3 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  {body}
                </Link>
              ) : (
                <div className="rounded-lg border border-black/10 p-3 dark:border-white/15">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">알림</h1>
      <Suspense fallback={null}>
        <NotificationsContent />
      </Suspense>
    </div>
  );
}
