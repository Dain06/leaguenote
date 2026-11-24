import type { Metadata } from "next";

import { MIN_AGE, PRIVACY_CONTACT, PRIVACY_VERSION } from "@/lib/privacy";

export const metadata: Metadata = { title: "개인정보 처리방침 · 리그노트" };

const sectionClass = "flex flex-col gap-2";
const listClass = "list-disc pl-5 text-sm text-black/80 dark:text-white/80";

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">개인정보 처리방침</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          시행일 {PRIVACY_VERSION} · 시범 운영 안내문입니다. 정식 공개 전에 내용을 다시 검토합니다.
        </p>
      </header>

      <section className={sectionClass}>
        <h2 className="font-semibold">1. 수집하는 개인정보와 목적</h2>
        <ul className={listClass}>
          <li>
            <b>필수 항목:</b> 이메일, 비밀번호, 닉네임, 휴대전화 번호, 거주 지역(시·도, 시·군·구)
          </li>
          <li>이메일·비밀번호: 가입 확인과 로그인 (비밀번호는 암호화되어 저장되며 운영자도 볼 수 없습니다)</li>
          <li>닉네임: 팀 안에서 나를 구분해 보여 주기 위한 이름 (실명은 받지 않습니다)</li>
          <li>휴대전화 번호: 같은 팀 운영자가 팀원에게 연락하기 위해 (같은 팀 운영자와 본인에게만 보입니다)</li>
          <li>거주 지역: 같은 지역 대회 매칭과 순위 공개 범위를 정하기 위해</li>
          <li>서비스 이용 중 생기는 기록: 출석·참가 응답, 회비 납부 확인, 경기 결과, 알림</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">2. 보유 기간과 파기</h2>
        <ul className={listClass}>
          <li>회원 탈퇴 시까지 보유하며, 탈퇴하면 이메일·닉네임·연락처·거주 지역과 본인의 응답·알림을 바로 삭제합니다.</li>
          <li>팀이 함께 쓰는 기록(일정, 회비 항목, 경기 결과)은 팀을 위해 남기되, 작성자와의 연결은 끊습니다.</li>
          <li>다른 팀원이 있는 팀의 운영자는 먼저 팀원을 내보내야 탈퇴할 수 있고, 혼자 남은 팀은 탈퇴와 함께 삭제됩니다.</li>
          <li>법령에 따라 별도로 보관해야 하는 정보는 수집하지 않습니다. (결제 기능 없음)</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">3. 제3자 제공과 처리 위탁</h2>
        <ul className={listClass}>
          <li>개인정보를 제3자에게 판매하거나 제공하지 않습니다.</li>
          <li>서비스 운영을 위해 데이터 저장·로그인(Supabase), 웹 서비스 제공(Vercel)에 처리를 맡깁니다.</li>
          <li>팀 안에서는 닉네임이 팀원에게 보이고, 연락처는 같은 팀 운영자와 본인에게만 보입니다.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">4. 이용자의 권리</h2>
        <ul className={listClass}>
          <li>닉네임·연락처·거주 지역 정보를 확인하고 고칠 수 있습니다.</li>
          <li>언제든지 &quot;내 계정&quot; 화면에서 비밀번호 확인 후 탈퇴할 수 있습니다.</li>
          <li>수집·이용에 동의하지 않을 수 있으나, 필수 항목에 동의하지 않으면 가입할 수 없습니다.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">5. 만 {MIN_AGE}세 미만</h2>
        <p className="text-sm text-black/80 dark:text-white/80">
          만 {MIN_AGE}세 미만은 가입할 수 없습니다. 가입할 때 만 {MIN_AGE}세 이상임을 확인합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">6. 안전하게 지키기 위한 조치</h2>
        <ul className={listClass}>
          <li>팀원이 아닌 사람은 팀 정보와 연락처를 볼 수 없도록 데이터베이스에서 접근을 제한합니다.</li>
          <li>서버 전용 비밀 키는 브라우저로 보내지 않습니다.</li>
          <li>암호화된 연결(HTTPS)로만 접속하도록 설정합니다.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">7. 문의</h2>
        <p className="text-sm text-black/80 dark:text-white/80">{PRIVACY_CONTACT}</p>
      </section>
    </article>
  );
}
