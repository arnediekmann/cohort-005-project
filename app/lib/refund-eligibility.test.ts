import { describe, it, expect } from "vitest";
import { checkRefundEligibility } from "./refund-eligibility";

// A fresh Purchase that meets every rule; each test breaks exactly one.
const eligiblePurchase = {
  purchasedAt: new Date(2026, 0, 1, 23, 0).toISOString(),
  today: new Date(2026, 0, 2, 12, 0),
  completedLessons: 0,
  totalLessons: 10,
  secondsWatched: 0,
  seatClaimed: false,
  hasOpenRefund: false,
};

describe("checkRefundEligibility", () => {
  describe("Refund Window", () => {
    it("is eligible on the last day of the window, even for a 23:00 purchase", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        today: new Date(2026, 0, 15, 23, 59),
      });

      expect(result).toEqual({ eligible: true, lastDayInWindow: "2026-01-15" });
    });

    it("is not eligible the day after the window closes", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        today: new Date(2026, 0, 16, 0, 0),
      });

      expect(result).toEqual({ eligible: false, reason: "window" });
    });
  });

  describe("watch-time limit", () => {
    it("is eligible just under two hours watched", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        secondsWatched: 7199,
      });

      expect(result.eligible).toBe(true);
    });

    it("is not eligible at two hours watched", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        secondsWatched: 7200,
      });

      expect(result).toEqual({ eligible: false, reason: "watched" });
    });
  });

  describe("completion limit", () => {
    it("is eligible with fewer than half the lessons completed", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        completedLessons: 4,
        totalLessons: 10,
      });

      expect(result.eligible).toBe(true);
    });

    it("is not eligible with half the lessons completed", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        completedLessons: 5,
        totalLessons: 10,
      });

      expect(result).toEqual({ eligible: false, reason: "completed" });
    });

    it("is eligible for a course with no lessons", () => {
      const result = checkRefundEligibility({
        ...eligiblePurchase,
        completedLessons: 0,
        totalLessons: 0,
      });

      expect(result.eligible).toBe(true);
    });
  });

  it("is not eligible for a claimed Seat", () => {
    const result = checkRefundEligibility({
      ...eligiblePurchase,
      seatClaimed: true,
    });

    expect(result).toEqual({ eligible: false, reason: "seat" });
  });

  it("is not eligible while another Refund on the Purchase is open", () => {
    const result = checkRefundEligibility({
      ...eligiblePurchase,
      hasOpenRefund: true,
    });

    expect(result).toEqual({ eligible: false, reason: "open" });
  });
});
