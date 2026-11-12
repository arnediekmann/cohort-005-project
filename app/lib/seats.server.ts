import { and, eq, isNull } from "drizzle-orm";
import { coupons, courses, enrollments, purchases, users } from "~/db/schema";
import { getSeatAvailability, type Db } from "~/lib/refunds.server";
import type { Notification } from "~/lib/notifier.server";

// Claiming a Seat on a Team Licence. Takes the database first, so tests can
// hand in an in-memory one.

export const SEAT_ON_HOLD =
  "This seat can't be claimed right now. Ask the person who shared it with you.";
export const SEAT_REFUNDED =
  "This seat is no longer available. Ask the person who shared it with you.";

export type SeatClaimResult =
  | {
      ok: true;
      enrollment: typeof enrollments.$inferSelect;
      notifications: Notification[];
    }
  | { ok: false; error: string };

export function claimSeat(
  db: Db,
  code: string,
  userId: number,
  userCountry: string
): SeatClaimResult {
  const seat = db.select().from(coupons).where(eq(coupons.code, code)).get();
  if (!seat) {
    return { ok: false, error: "Coupon not found" };
  }

  if (seat.redeemedByUserId !== null) {
    return { ok: false, error: "Coupon has already been redeemed" };
  }

  const availability = getSeatAvailability(db, seat);
  if (availability === "on_hold") {
    return { ok: false, error: SEAT_ON_HOLD };
  }
  if (availability === "refunded") {
    return { ok: false, error: SEAT_REFUNDED };
  }

  const existingEnrollment = db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, seat.courseId)
      )
    )
    .get();

  if (existingEnrollment) {
    return { ok: false, error: "You are already enrolled in this course" };
  }

  const purchase = db
    .select()
    .from(purchases)
    .where(eq(purchases.id, seat.purchaseId))
    .get();

  if (purchase?.country && purchase.country !== userCountry) {
    return {
      ok: false,
      error:
        "This coupon can only be redeemed from the same country as the purchaser",
    };
  }

  db.update(coupons)
    .set({
      redeemedByUserId: userId,
      redeemedAt: new Date().toISOString(),
    })
    .where(eq(coupons.id, seat.id))
    .run();

  const enrollment = db
    .insert(enrollments)
    .values({ userId, courseId: seat.courseId })
    .returning()
    .get();

  return { ok: true, enrollment, notifications: allSeatsClaimed(db, seat) };
}

/** One All Seats claimed Notification to the buyer once the Team Licence has no Unclaimed Seat left. */
function allSeatsClaimed(
  db: Db,
  seat: typeof coupons.$inferSelect
): Notification[] {
  const unclaimed = db
    .select({ id: coupons.id })
    .from(coupons)
    .where(
      and(
        eq(coupons.purchaseId, seat.purchaseId),
        isNull(coupons.redeemedByUserId)
      )
    )
    .get();
  if (unclaimed) return [];

  const licence = db
    .select({
      buyerId: users.id,
      buyerName: users.name,
      courseTitle: courses.title,
    })
    .from(purchases)
    .innerJoin(users, eq(users.id, purchases.userId))
    .innerJoin(courses, eq(courses.id, purchases.courseId))
    .where(eq(purchases.id, seat.purchaseId))
    .get();
  if (!licence) return [];

  return [
    {
      workflow: "all-seats-claimed",
      recipients: [{ id: String(licence.buyerId), name: licence.buyerName }],
      data: { courseTitle: licence.courseTitle, link: "/team" },
    },
  ];
}
