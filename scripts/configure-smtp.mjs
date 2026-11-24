// 운영 Supabase에 별도 메일 서버(SMTP)를 연결한다. (가입 확인 메일 발송 한도를 늘리기 위해)
//
// 사용법 (my-app 폴더에서):
//   node --env-file=.env scripts/configure-smtp.mjs          # 값 점검만 (아무것도 바꾸지 않음)
//   node --env-file=.env scripts/configure-smtp.mjs --apply  # 운영 프로젝트에 적용
//
// .env에 아래 값을 먼저 넣어 두세요. (값은 화면에 출력하지 않습니다)
//   PROD_SMTP_HOST     메일 서비스의 SMTP 서버 주소 (예: smtp.resend.com)
//   PROD_SMTP_PORT     보통 465 또는 587
//   PROD_SMTP_USER     SMTP 사용자 이름 (Resend는 resend)
//   PROD_SMTP_PASS     SMTP 비밀번호(API 키)
//   PROD_SMTP_FROM     보내는 사람 이메일 (메일 서비스에서 인증한 주소/도메인)
//   PROD_SMTP_SENDER_NAME  (선택) 보내는 사람 이름, 기본값 "리그노트"
//   PROD_EMAIL_RATE_LIMIT  (선택) 시간당 발송 한도, 기본값 30
// 개발용 프로젝트에는 적용하지 않는다. (개발은 이메일 확인을 끈 채로 시험한다)

const need = ["PROD_SMTP_HOST", "PROD_SMTP_PORT", "PROD_SMTP_USER", "PROD_SMTP_PASS", "PROD_SMTP_FROM"];
const missing = need.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.log("아직 .env에 없는 값:", missing.join(", "));
  console.log("메일 서비스에서 SMTP 정보를 받아 위 값을 .env에 넣은 뒤 다시 실행하세요.");
  process.exit(1);
}

const port = Number(process.env.PROD_SMTP_PORT.trim());
const from = process.env.PROD_SMTP_FROM.trim();
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.log("PROD_SMTP_PORT가 올바른 숫자가 아닙니다.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
  console.log("PROD_SMTP_FROM이 이메일 형식이 아닙니다.");
  process.exit(1);
}

const body = {
  external_email_enabled: true,
  smtp_host: process.env.PROD_SMTP_HOST.trim(),
  smtp_port: String(port),
  smtp_user: process.env.PROD_SMTP_USER.trim(),
  smtp_pass: process.env.PROD_SMTP_PASS.trim(),
  smtp_admin_email: from,
  smtp_sender_name: process.env.PROD_SMTP_SENDER_NAME?.trim() || "리그노트",
  rate_limit_email_sent: Number(process.env.PROD_EMAIL_RATE_LIMIT?.trim() || 30),
};

console.log("적용할 값(비밀번호 제외):", { ...body, smtp_pass: "(숨김)", smtp_user: "(숨김)" });
if (!process.argv.includes("--apply")) {
  console.log("점검만 했습니다. 적용하려면 --apply를 붙여 다시 실행하세요.");
  process.exit(0);
}

const ref = process.env.PROD_SUPABASE_PROJECT_REF.trim();
const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN.trim()}`, "Content-Type": "application/json" };
const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
if (!res.ok) {
  console.log("적용 실패", res.status, (await res.text()).replaceAll(body.smtp_pass, "***").slice(0, 300));
  process.exit(1);
}
const now = await (await fetch(url, { headers })).json();
console.log("적용됨:", {
  smtp_host: now.smtp_host,
  smtp_port: now.smtp_port,
  smtp_admin_email: now.smtp_admin_email,
  rate_limit_email_sent: now.rate_limit_email_sent,
  mailer_autoconfirm: now.mailer_autoconfirm,
});
