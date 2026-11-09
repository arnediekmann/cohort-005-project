export const REFUND_WINDOW_DAYS = 14;
const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
const REFUND_COMPLETION_LIMIT = 0.5;

export type RefundFacts = {
  purchasedAt: string;
  today: Date;
  completedLessons: number;
  totalLessons: number;
  secondsWatched: number;
  seatClaimed: boolean;
  hasOpenRefund: boolean;
};

export type RefundEligibility =
  | { eligible: true; lastDayInWindow: string }
  | {
      eligible: false;
      reason: "open" | "seat" | "window" | "watched" | "completed";
    };

// The Refund Window is counted in whole days, not hours — someone who buys at
// 23:00 should still get the whole of their fourteenth day.
function calendarDay(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

export function checkRefundEligibility(facts: RefundFacts): RefundEligibility {
  if (facts.hasOpenRefund) return { eligible: false, reason: "open" };

  // A claimed Seat belongs to the team — the learner cannot hand it back.
  if (facts.seatClaimed) return { eligible: false, reason: "seat" };

  const windowEnd = new Date(facts.purchasedAt);
  windowEnd.setDate(windowEnd.getDate() + REFUND_WINDOW_DAYS);
  const lastDayInWindow = calendarDay(windowEnd);

  if (calendarDay(facts.today) > lastDayInWindow) {
    return { eligible: false, reason: "window" };
  }

  if (facts.secondsWatched >= REFUND_WATCH_LIMIT_SECONDS) {
    return { eligible: false, reason: "watched" };
  }

  if (
    facts.totalLessons > 0 &&
    facts.completedLessons / facts.totalLessons >= REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "completed" };
  }

  return { eligible: true, lastDayInWindow };
}
