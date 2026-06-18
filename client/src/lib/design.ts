// ─── 공통 디자인 토큰 ────────────────────────────────────────────────────────
// 모든 페이지에서 동일한 색상/스타일 상수를 사용합니다.

export const NAV_STYLE = {
  background: "oklch(0.18 0.04 250)",
  borderBottom: "1px solid oklch(0.28 0.04 250)",
} as const;

export const CARD_STYLE = {
  background: "oklch(1 0 0)",
  border: "1px solid oklch(0.90 0.01 240)",
  boxShadow: "0 1px 3px oklch(0.15 0.02 240 / 0.06)",
} as const;

export const SECTION_BG = "oklch(0.97 0.005 240)";

// 배차 승인 상태 색상
export const DISPATCH_STATUS_CONFIG = {
  pending: {
    label: "대기",
    color: "oklch(0.52 0.14 75)",
    bg: "oklch(0.78 0.12 75 / 0.12)",
    border: "oklch(0.78 0.12 75 / 0.35)",
  },
  confirmed: {
    label: "확인",
    color: "oklch(0.38 0.18 250)",
    bg: "oklch(0.55 0.18 250 / 0.10)",
    border: "oklch(0.55 0.18 250 / 0.30)",
  },
  completed: {
    label: "완료",
    color: "oklch(0.36 0.16 145)",
    bg: "oklch(0.55 0.18 145 / 0.10)",
    border: "oklch(0.55 0.18 145 / 0.30)",
  },
  cancelled: {
    label: "취소",
    color: "oklch(0.48 0.05 240)",
    bg: "oklch(0.55 0.03 240 / 0.08)",
    border: "oklch(0.55 0.03 240 / 0.20)",
  },
} as const;

// 기사 운행 상태 색상
export const DRIVER_STATUS_CONFIG = {
  idle: {
    label: "대기중",
    color: "oklch(0.38 0.18 250)",
    bg: "oklch(0.55 0.18 250 / 0.10)",
    border: "oklch(0.55 0.18 250 / 0.30)",
  },
  driving: {
    label: "운행중",
    color: "oklch(0.36 0.16 145)",
    bg: "oklch(0.55 0.18 145 / 0.10)",
    border: "oklch(0.55 0.18 145 / 0.30)",
  },
  repair: {
    label: "수리중",
    color: "oklch(0.48 0.20 25)",
    bg: "oklch(0.55 0.22 25 / 0.10)",
    border: "oklch(0.55 0.22 25 / 0.30)",
  },
} as const;

// ─── 공통 유틸 함수 ──────────────────────────────────────────────────────────

export function formatArrivalDeadlineKorean(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  if (minute === 0) {
    return `${year}년 ${month}월 ${day}일 ${hour}시`;
  }
  return `${year}년 ${month}월 ${day}일 ${hour}시 ${minute}분`;
}

export function getDeadlineUrgency(
  deadline: Date | null | undefined
): "overdue" | "urgent" | "normal" | "none" {
  if (!deadline) return "none";
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diffMs = deadlineMs - now;
  if (diffMs < 0) return "overdue";
  if (diffMs < 60 * 60 * 1000) return "urgent";
  return "normal";
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return amount.toLocaleString("ko-KR") + "원";
}
