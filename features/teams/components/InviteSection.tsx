// Design Ref: §3.1 `/teams/[id]` 팀 홈 — 초대 링크 (운영자만 보임)
import { formatKst } from "@/lib/time";

import { createInvite, revokeInvites } from "../actions";
import { getActiveInvite } from "../queries";
import ConfirmSubmitButton from "./ConfirmSubmitButton";
import CopyLink from "./CopyLink";

const buttonClass =
  "rounded-md border border-black/20 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

export default async function InviteSection({ teamId }: { teamId: string }) {
  const invite = await getActiveInvite(teamId);

  return (
    <section
      aria-label="팀원 초대"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">팀원 초대</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        링크를 받은 사람이 로그인한 뒤 열면 팀에 들어올 수 있습니다. 링크는 7일 동안 유효하고,
        새 링크를 만들면 이전 링크는 바로 쓸 수 없게 됩니다.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {invite ? (
          <>
            <CopyLink path={`/invite/${invite.code}`} />
            <p className="text-xs text-black/50 dark:text-white/50" data-testid="invite-status">
              {formatKst(invite.expires_at)}까지 · 사용 {invite.use_count}/{invite.max_uses}명
            </p>
          </>
        ) : (
          <p className="text-sm text-black/60 dark:text-white/60" data-testid="invite-none">
            지금 쓸 수 있는 초대 링크가 없습니다.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <form action={createInvite.bind(null, teamId)}>
            <button type="submit" className={buttonClass}>
              {invite ? "새 초대 링크 만들기" : "초대 링크 만들기"}
            </button>
          </form>
          {invite && (
            <form action={revokeInvites.bind(null, teamId)}>
              <ConfirmSubmitButton
                className={buttonClass}
                message="초대 링크를 끄면 지금 링크로는 더 이상 팀에 들어올 수 없습니다. 끌까요?"
              >
                초대 링크 끄기
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
