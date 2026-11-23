// 매칭 점검용 가상 팀 만들기 (Plan 작업 8번)
//
// 사용법 (my-app 폴더에서):
//   node --env-file=.env scripts/seed-demo-teams.mjs          가상 팀 만들기(여러 번 실행해도 중복 없음)
//   node --env-file=.env scripts/seed-demo-teams.mjs --remove 가상 팀과 가상 운영자 계정 지우기
//
// .env의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 읽어 쓴다. (값은 출력하지 않는다)
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMAIL = "demo-operator@leaguenote.test"; // .test 는 실제로 쓰이지 않는 예약 도메인
const PREFIX = "(가상) ";

// [팀 이름, 종목, 한 경기 필요 인원, 시·도, 구, 팀 인원, 팀 경력(개월), 점검 메모]
// 경력 구간: 24개월 미만 / 24~47개월 / 48개월 이상 (PRD: 2년 미만, 2~4년, 4년 이상)
const TEAMS = [
  // 풋살 · 서울 8팀 — 한 묶음(4~8팀)이 만들어지는지, 경력 구간·인원 차이가 갈리는지 확인
  ["강남 불꽃FC", "풋살", 5, "서울특별시", "강남구", 10, 8, "2년 미만"],
  ["마포 블루윙즈", "풋살", 5, "서울특별시", "마포구", 12, 14, "2년 미만"],
  ["송파 호랑이", "풋살", 5, "서울특별시", "송파구", 11, 20, "2년 미만"],
  ["관악 스트라이커즈", "풋살", 5, "서울특별시", "관악구", 13, 30, "2~4년"],
  ["성동 레드스타", "풋살", 5, "서울특별시", "성동구", 14, 36, "2~4년"],
  ["노원 이글스", "풋살", 5, "서울특별시", "노원구", 9, 50, "4년 이상"],
  ["영등포 올드보이즈", "풋살", 5, "서울특별시", "영등포구", 16, 60, "4년 이상, 인원 차이 큼"],
  ["용산 새벽FC", "풋살", 5, "서울특별시", "용산구", 15, 100, "4년 이상, 경력 매우 김"],
  // 농구 · 서울 4팀 + 부산 2팀 — 같은 종목이어도 시가 다르면 묶이지 않는지 확인
  ["종로 덩크", "농구", 5, "서울특별시", "종로구", 10, 3, "2년 미만"],
  ["서초 리바운드", "농구", 5, "서울특별시", "서초구", 12, 22, "경계: 23개월 이하"],
  ["강동 점퍼스", "농구", 5, "서울특별시", "강동구", 13, 47, "경계: 47개월"],
  ["동작 스크린", "농구", 5, "서울특별시", "동작구", 15, 48, "경계: 48개월(4년)"],
  ["해운대 슬램", "농구", 5, "부산광역시", "해운대구", 11, 12, "다른 시"],
  ["수영 코트킹", "농구", 5, "부산광역시", "수영구", 12, 26, "다른 시"],
  // 배드민턴 · 서울 4팀 — 한 경기 1명인 종목(최소 인원 3), 인원이 크게 다른 팀 포함
  ["은평 셔틀콕", "배드민턴", 1, "서울특별시", "은평구", 8, 10, "2년 미만"],
  ["도봉 스매시", "배드민턴", 1, "서울특별시", "도봉구", 11, 24, "경계: 24개월(2년)"],
  ["강서 클리어", "배드민턴", 1, "서울특별시", "강서구", 14, 40, "2~4년"],
  ["광진 드롭샷", "배드민턴", 1, "서울특별시", "광진구", 20, 72, "4년 이상, 인원 많음"],
];

async function findDemoUserId() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === DEMO_EMAIL);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function removeAll() {
  const { error: teamError, count } = await db
    .from("teams")
    .delete({ count: "exact" })
    .eq("is_demo", true);
  if (teamError) throw teamError;

  const userId = await findDemoUserId();
  if (userId) {
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
  console.log(`가상 팀 ${count ?? 0}개와 가상 운영자 계정을 지웠습니다.`);
}

async function ensureDemoUser() {
  const existing = await findDemoUserId();
  if (existing) return existing;

  // 아무도 로그인할 수 없도록 무작위 비밀번호를 쓰고 어디에도 출력·저장하지 않는다.
  const { data, error } = await db.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: {
      nickname: "가상운영자",
      phone: "000-0000-0000",
      city: "서울특별시",
      district: "중구",
    },
  });
  if (error) throw error;
  return data.user.id;
}

async function seed() {
  const userId = await ensureDemoUser();

  let created = 0;
  for (const [name, sport, required, city, district, size, career, note] of TEAMS) {
    const teamName = `${PREFIX}${name}`;

    let { data: team } = await db
      .from("teams")
      .select("id")
      .eq("is_demo", true)
      .eq("name", teamName)
      .maybeSingle();

    if (!team) {
      const { data, error } = await db
        .from("teams")
        .insert({
          name: teamName,
          sport,
          required_players: required,
          city,
          district,
          created_by: userId,
          is_demo: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      team = data;
      created += 1;

      const { error: memberError } = await db
        .from("team_members")
        .insert({ team_id: team.id, user_id: userId, role: "operator" });
      if (memberError) throw memberError;
    }

    const { error: profileError } = await db.from("demo_team_profiles").upsert({
      team_id: team.id,
      team_size: size,
      career_months: career,
      note,
    });
    if (profileError) throw profileError;
  }

  console.log(`가상 팀 ${TEAMS.length}개 준비 완료 (이번에 새로 만든 팀 ${created}개).`);
}

if (process.argv.includes("--remove")) {
  await removeAll();
} else {
  await seed();
}
