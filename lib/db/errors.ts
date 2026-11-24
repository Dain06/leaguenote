// 데이터베이스 함수가 돌려준 오류를 사용자에게 보여 줄 문구로 바꾼다.
// 함수가 일부러 낸 한국어 안내(raise exception, 오류 코드 P0001)만 그대로 보여 주고,
// 예상하지 못한 오류(표 이름·제약 이름 같은 내부 정보가 담길 수 있음)는 일반 안내로 바꾼다.

export function friendlyDbError(
  error: { code?: string; message: string },
  fallback = "처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
): string {
  return error.code === "P0001" ? error.message : fallback;
}
