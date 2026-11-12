import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { claimSeat } from "./seats.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let purchase: typeof schema.purchases.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const buyer = addStudent("Bea");
  purchase = db
    .insert(schema.purchases)
    .values({
      userId: buyer.id,
      courseId: base.course.id,
      amountPaid: 15800,
      country: "DE",
    })
    .returning()
    .get();
  const team = db.insert(schema.teams).values({}).returning().get();
  for (const code of ["SEAT-1", "SEAT-2"]) {
    db.insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId: base.course.id,
        code,
        purchaseId: purchase.id,
      })
      .run();
  }
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

describe("claiming a Seat", () => {
  it("claims the Seat and creates the Enrollment", () => {
    const student = addStudent("Sam");

    const result = claimSeat(db, "SEAT-1", student.id, "DE");

    expect(result).toMatchObject({
      ok: true,
      enrollment: { userId: student.id, courseId: base.course.id },
    });
  });

  it("rejects a Seat that is already claimed", () => {
    claimSeat(db, "SEAT-1", addStudent("Sam").id, "DE");

    const result = claimSeat(db, "SEAT-1", addStudent("Kim").id, "DE");

    expect(result).toEqual({
      ok: false,
      error: "Coupon has already been redeemed",
    });
  });

  it("rejects an unknown code", () => {
    const result = claimSeat(db, "NOPE", addStudent("Sam").id, "DE");

    expect(result).toEqual({ ok: false, error: "Coupon not found" });
  });

  it("puts the Seat on hold while the Team Licence has an Open Refund Request", () => {
    db.insert(schema.refunds)
      .values({ purchaseId: purchase.id, reason: "Not for us." })
      .run();

    const result = claimSeat(db, "SEAT-1", addStudent("Sam").id, "DE");

    expect(result).toEqual({
      ok: false,
      error:
        "This seat can't be claimed right now. Ask the person who shared it with you.",
    });
  });

  it("rejects a refunded Seat", () => {
    db.update(schema.coupons)
      .set({ refundedAt: new Date().toISOString() })
      .where(eq(schema.coupons.code, "SEAT-1"))
      .run();

    const result = claimSeat(db, "SEAT-1", addStudent("Sam").id, "DE");

    expect(result).toEqual({
      ok: false,
      error:
        "This seat is no longer available. Ask the person who shared it with you.",
    });
  });

  it("rejects a Student who is already enrolled, leaving the Seat unclaimed", () => {
    const student = addStudent("Sam");
    claimSeat(db, "SEAT-1", student.id, "DE");

    const result = claimSeat(db, "SEAT-2", student.id, "DE");

    expect(result).toEqual({
      ok: false,
      error: "You are already enrolled in this course",
    });
    expect(claimSeat(db, "SEAT-2", addStudent("Kim").id, "DE").ok).toBe(true);
  });

  it("rejects a claim from another country than the buyer's", () => {
    const result = claimSeat(db, "SEAT-1", addStudent("Sam").id, "FR");

    expect(result).toEqual({
      ok: false,
      error:
        "This coupon can only be redeemed from the same country as the purchaser",
    });
  });
});
