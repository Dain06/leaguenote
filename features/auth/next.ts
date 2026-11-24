// 로그인·가입이 끝난 뒤 돌아갈 주소를 안전하게 고른다.
// 이 사이트 안의 주소("/"로 시작)만 허용하고, 그 밖의 값은 홈("/")으로 보낸다.
//
// 보이지 않는 문자(탭·줄바꿈 등)와 역슬래시는 거부한다. 브라우저는 주소를 읽을 때 탭·줄바꿈을 지우기 때문에
// "/<탭>/evil.com"이 "//evil.com"(다른 사이트)이 되어 검사를 빠져나갈 수 있다.

// 맨 앞은 "/" 한 개여야 하고("//" 금지), 그 뒤에는 공백류(\s: 탭·줄바꿈·nbsp·줄 구분 문자 포함),
// 제어 문자(0x00-0x1F, 0x7F-0x9F), 역슬래시가 하나도 없어야 한다.
const SAFE_PATH = /^\/(?!\/)[^\s\x00-\x1f\x7f-\x9f\\]*$/;

export function safeNextPath(value: unknown): string {
  if (typeof value === "string" && SAFE_PATH.test(value)) {
    return value;
  }
  return "/";
}
