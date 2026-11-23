// Design Ref: §6 기술 선택 — 데이터 저장소(Supabase) 연결 정보는 환경 변수에서만 읽는다.
// 값 자체는 어디에도 출력하지 않고, "있는지 없는지"만 확인한다.

/** 앱 실행에 필요한 Supabase 환경 변수 이름 (값은 .env / Vercel 환경변수에 둔다) */
export const DB_ENV_NAMES = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
} as const;

/** 필요한 연결 정보가 모두 채워져 있는지 확인한다. (값은 확인만 하고 내보내지 않는다) */
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** 연결 정보를 꺼낸다. 없으면 어떤 값이 빠졌는지 한국어로 알려 주는 오류를 낸다. */
export function getDbEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      `데이터 저장소 연결 정보가 없습니다. .env에 ${DB_ENV_NAMES.url}와 ${DB_ENV_NAMES.anonKey}를 추가해 주세요.`,
    );
  }

  return { url, anonKey };
}
