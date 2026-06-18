// 기사 인증 토큰 localStorage 키 (쿠키 차단 환경 폴백용)
export const DRIVER_TOKEN_KEY = "driver_auth_token";

export function getDriverToken(): string | null {
  return localStorage.getItem(DRIVER_TOKEN_KEY);
}

export function setDriverToken(token: string): void {
  localStorage.setItem(DRIVER_TOKEN_KEY, token);
}

export function removeDriverToken(): void {
  localStorage.removeItem(DRIVER_TOKEN_KEY);
}
