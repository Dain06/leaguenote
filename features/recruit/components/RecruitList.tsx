// Design Ref: §3.1 `/recruit` — 동네별 팀원 모집 글 목록
import { deleteRecruitPost, setRecruitStatus } from "../actions";
import type { RecruitPost } from "../queries";

const smallButton =
  "rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export default function RecruitList({
  posts,
  operatorTeamIds,
}: {
  posts: RecruitPost[];
  operatorTeamIds: Set<string>;
}) {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60" data-testid="recruit-empty">
        아직 올라온 모집 글이 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="recruit-list">
      {posts.map((post) => {
        const mine = operatorTeamIds.has(post.team_id);
        const closed = post.status === "closed";
        return (
          <li
            key={post.id}
            className={`flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15 ${
              closed ? "opacity-60" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{post.title}</span>
              <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
                {post.sport}
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                {closed ? "모집 마감" : `${post.needed_count}명 모집`}
              </span>
            </div>
            <p className="text-black/60 dark:text-white/60">
              {post.team_name} · {post.city} {post.district} · {formatDate(post.created_at)}
            </p>
            <p className="whitespace-pre-wrap">{post.body}</p>
            {mine && (
              <div className="mt-1 flex gap-2">
                <form action={setRecruitStatus.bind(null, post.id, closed ? "open" : "closed")}>
                  <button type="submit" className={smallButton}>
                    {closed ? "다시 모집" : "모집 마감"}
                  </button>
                </form>
                <form action={deleteRecruitPost.bind(null, post.id)}>
                  <button type="submit" className={smallButton}>
                    삭제
                  </button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
