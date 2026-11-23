// Design Ref: §3.1 용병 모집 글 목록 — 시간·종목·지역·필요 인원만 보인다. 상세 장소는 수락된 뒤 알림으로 알려 준다.
import { formatKst } from "@/lib/time";

import { applyMercenary, withdrawMercenary } from "../actions";
import type { BoardPost } from "../queries";

const smallButton =
  "rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

export default function MercenaryBoard({ posts }: { posts: BoardPost[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60" data-testid="mercenary-empty">
        지금 모집 중인 용병 글이 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="mercenary-board">
      {posts.map((p) => (
        <li
          key={p.post_id}
          className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{formatKst(p.starts_at)}</span>
            <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
              {p.sport}
            </span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
              필요 {p.needed_count}명 (수락 {p.accepted_count}명)
            </span>
          </div>
          <p className="text-black/60 dark:text-white/60">
            {p.city} {p.district}
          </p>

          {p.is_my_team ? (
            <p className="text-xs text-black/50 dark:text-white/50">우리 팀의 모집 글입니다.</p>
          ) : p.my_status === "applied" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs">지원함 · 운영자의 응답을 기다리는 중</span>
              <form action={withdrawMercenary.bind(null, p.post_id)}>
                <button type="submit" className={smallButton}>
                  지원 취소
                </button>
              </form>
            </div>
          ) : p.my_status === "accepted" ? (
            <p className="text-xs font-medium text-green-700 dark:text-green-400">
              수락되었습니다. 장소는 알림함에서 확인하세요.
            </p>
          ) : p.my_status === "rejected" ? (
            <p className="text-xs text-black/50 dark:text-white/50">이번 지원은 받아들여지지 않았습니다.</p>
          ) : (
            <form action={applyMercenary.bind(null, p.post_id)}>
              <button type="submit" className={smallButton}>
                지원하기
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
