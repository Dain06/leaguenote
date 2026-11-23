// 로그인·가입이 끝난 뒤 돌아갈 주소를 안전하게 고른다.
// 이 사이트 안의 주소("/"로 시작)만 허용하고, 그 밖의 값은 홈("/")으로 보낸다.

export function safeNextPath(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }
  return "/";
}
