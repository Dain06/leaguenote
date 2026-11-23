// Design Ref: §3.1 `/` 홈 — 알림 개수
import Link from "next/link";

import { getCurrentUser } from "@/features/auth/queries";

import { getMyNotifications, getUnreadCount } from "../queries";

export default async function HomeNotifications() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        로그인하면 새 알림 개수가 여기에 보입니다.
      </p>
    );
  }

  const [unread, latest] = await Promise.all([
    getUnreadCount(),
    getMyNotifications(3),
  ]);

  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      <p data-testid="home-unread">
        {unread > 0 ? (
          <>
            읽지 않은 알림 <strong>{unread}개</strong>
          </>
        ) : (
          <span className="text-black/60 dark:text-white/60">
            새 알림이 없습니다.
          </span>
        )}
      </p>
      {latest.length > 0 && (
        <ul className="flex flex-col gap-1 text-black/70 dark:text-white/70">
          {latest.map((item) => (
            <li key={item.id} className="line-clamp-2">
              {item.message}
            </li>
          ))}
        </ul>
      )}
      <Link href="/notifications" className="font-medium underline">
        알림함 열기
      </Link>
    </div>
  );
}
