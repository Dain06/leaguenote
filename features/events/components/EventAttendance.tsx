// Design Ref: §3.2 일정 상세 "3) 출석 투표" — 시작 2시간 전 게시, 시작 30분 전 마감, 확정 선수가 투표
import { isAttendancePollOpen } from "@/lib/rules";
import { formatKst } from "@/lib/time";

import { respondAttendance } from "../actions";
import type { AttendanceMember, EventWithTeam } from "../queries";

const buttonBase =
  "rounded-md border px-4 py-2 text-sm font-medium transition-colors";

function NameList({ title, members }: { title: string; members: AttendanceMember[] }) {
  return (
    <div>
      <dt className="text-black/50 dark:text-white/50">
        {title} {members.length}명
      </dt>
      <dd className="mt-0.5">
        {members.length === 0 ? "-" : members.map((m) => m.nickname).join(", ")}
      </dd>
    </div>
  );
}

export default function EventAttendance({
  event,
  attendance,
  myUserId,
}: {
  event: EventWithTeam;
  attendance: AttendanceMember[];
  myUserId: string;
}) {
  const now = new Date();
  const opensAt = new Date(event.attendance_opens_at);
  const closesAt = new Date(event.attendance_closes_at);
  const cancelled = event.status === "cancelled";

  const notYetOpen = now.getTime() < opensAt.getTime();
  const open = !cancelled && isAttendancePollOpen(opensAt, closesAt, now);

  const mine = attendance.find((m) => m.user_id === myUserId);
  const isPlayer = mine !== undefined;
  const present = attendance.filter((m) => m.response === "present");
  const absent = attendance.filter((m) => m.response === "absent");
  const pending = attendance.filter((m) => m.response === null);
  const voted = present.length + absent.length;
  const participation =
    attendance.length === 0 ? 0 : Math.round((voted / attendance.length) * 100);

  return (
    <section
      aria-label="출석 투표"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-semibold">3) 출석 투표</h2>

      {cancelled ? (
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          취소된 일정입니다.
        </p>
      ) : notYetOpen ? (
        <p className="mt-2 text-sm text-black/60 dark:text-white/60" data-testid="attendance-before">
          출석 투표는 {formatKst(opensAt)}에 자동으로 게시되고, {formatKst(closesAt)}에
          마감됩니다. 확정된 선수만 투표할 수 있습니다.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm" data-testid="attendance-summary">
            {open ? "투표 진행 중" : "투표가 마감되었습니다"} · 확정 선수{" "}
            {attendance.length}명 중 <strong>{voted}명</strong> 투표 (참여율{" "}
            {participation}%)
          </p>

          {open && isPlayer && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <form action={respondAttendance.bind(null, event.id, "present")}>
                  <button
                    type="submit"
                    aria-pressed={mine?.response === "present"}
                    className={`${buttonBase} ${
                      mine?.response === "present"
                        ? "border-transparent bg-foreground text-background"
                        : "border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                    }`}
                  >
                    출석
                  </button>
                </form>
                <form action={respondAttendance.bind(null, event.id, "absent")}>
                  <button
                    type="submit"
                    aria-pressed={mine?.response === "absent"}
                    className={`${buttonBase} ${
                      mine?.response === "absent"
                        ? "border-transparent bg-foreground text-background"
                        : "border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                    }`}
                  >
                    불참
                  </button>
                </form>
              </div>
              <p className="text-xs text-black/50 dark:text-white/50" data-testid="attendance-my-response">
                내 투표: {mine?.response === "present" ? "출석" : mine?.response === "absent" ? "불참" : "아직 없음"}{" "}
                · {formatKst(closesAt)}까지 바꿀 수 있습니다.
              </p>
            </div>
          )}
          {open && !isPlayer && (
            <p className="mt-3 text-sm text-black/60 dark:text-white/60" data-testid="attendance-not-player">
              확정된 선수만 투표할 수 있습니다.
            </p>
          )}
          {!open && isPlayer && (
            <p className="mt-3 text-sm text-black/60 dark:text-white/60">
              내 투표: {mine?.response === "present" ? "출석" : mine?.response === "absent" ? "불참" : "없음"}
            </p>
          )}

          <dl className="mt-4 grid gap-3 text-sm" data-testid="attendance-lists">
            <NameList title="출석" members={present} />
            <NameList title="불참" members={absent} />
            <NameList title="미투표" members={pending} />
          </dl>
        </>
      )}
    </section>
  );
}
