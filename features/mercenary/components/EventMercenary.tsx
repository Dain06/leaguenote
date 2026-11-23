// Design Ref: §3.1 `/events/[id]/mercenary` — 일정 상세의 용병 모집: 글 올리기, 지원자 수락·거절(운영자), 수락된 용병 표시
import { isSurveyOpen } from "@/lib/rules";

import type { EventWithTeam } from "@/features/events/queries";

import {
  acceptMercenary,
  rejectMercenary,
  setMercenaryStatus,
} from "../actions";
import type { Applicant, EventPost } from "../queries";

import MercenaryPostForm from "./MercenaryPostForm";

const smallButton =
  "rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

const STATUS_LABEL: Record<Applicant["status"], string> = {
  applied: "지원함",
  accepted: "수락됨",
  rejected: "거절됨",
};

export default function EventMercenary({
  event,
  isOperator,
  post,
  applicants,
  mercenaries,
}: {
  event: EventWithTeam;
  isOperator: boolean;
  post: EventPost | null;
  applicants: Applicant[];
  mercenaries: { user_id: string; nickname: string }[];
}) {
  if (event.status === "cancelled") return null;

  const open = isSurveyOpen(event.starts_at);

  // 팀원에게는 모집 상황만 보여 주고, 팀원이 할 일은 없다.
  if (!isOperator) {
    if (!post && mercenaries.length === 0) return null;
    return (
      <section
        aria-label="용병"
        className="rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <h2 className="font-semibold">용병</h2>
        <p className="mt-2 text-sm" data-testid="mercenary-member-view">
          {post ? (post.status === "open" ? `용병 ${post.needed_count}명 모집 중` : "용병 모집 마감") : ""}
          {mercenaries.length > 0 && ` · 확정된 용병: ${mercenaries.map((m) => m.nickname).join(", ")}`}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="용병"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">용병 모집</h2>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        글에는 시간·종목·지역·필요 인원만 공개되고 장소는 숨겨집니다. 수락한 지원자에게만 장소를 알려 줍니다.
      </p>

      {!post && open && <MercenaryPostForm eventId={event.id} />}
      {!post && !open && (
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          선수 확정이 마감되어 용병을 모집할 수 없습니다.
        </p>
      )}

      {post && (
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="mercenary-post">
            <span>
              필요 {post.needed_count}명 ·{" "}
              {post.status === "open" ? "모집 중" : "모집 마감"}
            </span>
            <form
              action={setMercenaryStatus.bind(
                null,
                event.id,
                post.id,
                post.status === "open" ? "closed" : "open",
              )}
            >
              <button type="submit" className={smallButton}>
                {post.status === "open" ? "모집 마감" : "다시 모집"}
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-medium">지원자 ({applicants.length}명)</h3>
            {applicants.length === 0 ? (
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">아직 지원자가 없습니다.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1 text-sm" data-testid="applicants">
                {applicants.map((a) => (
                  <li key={a.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{a.nickname}</span>
                    <span className="text-black/60 dark:text-white/60">{STATUS_LABEL[a.status]}</span>
                    {open && a.status !== "accepted" && (
                      <form action={acceptMercenary.bind(null, event.id, post.id, a.user_id)}>
                        <button type="submit" className={smallButton}>
                          수락
                        </button>
                      </form>
                    )}
                    {open && a.status === "applied" && (
                      <form action={rejectMercenary.bind(null, event.id, post.id, a.user_id)}>
                        <button type="submit" className={smallButton}>
                          거절
                        </button>
                      </form>
                    )}
                    {open && a.status === "accepted" && (
                      <form action={rejectMercenary.bind(null, event.id, post.id, a.user_id)}>
                        <button type="submit" className={smallButton}>
                          수락 취소
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mercenaries.length > 0 && (
        <p className="mt-3 text-sm" data-testid="mercenary-names">
          확정된 용병 {mercenaries.length}명: {mercenaries.map((m) => m.nickname).join(", ")}
        </p>
      )}
    </section>
  );
}
