// Design Ref: §3.1 `/teams/[id]` 팀 홈 — 초대 링크 (운영자만 보임)
import { createInvite } from "../actions";
import { getActiveInviteCode } from "../queries";
import CopyLink from "./CopyLink";

export default async function InviteSection({ teamId }: { teamId: string }) {
  const code = await getActiveInviteCode(teamId);

  return (
    <section
      aria-label="팀원 초대"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">팀원 초대</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        링크를 받은 사람이 로그인한 뒤 열면 팀에 들어올 수 있습니다. (7일 동안 유효)
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {code && <CopyLink path={`/invite/${code}`} />}
        <form action={createInvite.bind(null, teamId)}>
          <button
            type="submit"
            className="rounded-md border border-black/20 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            {code ? "새 초대 링크 만들기" : "초대 링크 만들기"}
          </button>
        </form>
      </div>
    </section>
  );
}
