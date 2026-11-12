import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { getNote, listNotesForStudent, saveNote } from "./notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date("2026-10-06T12:00:00.000Z");
const LATER = new Date("2026-10-07T12:00:00.000Z");

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const courseModule = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({
          moduleId: courseModule.id,
          title: `Lesson ${position}`,
          position,
        })
        .returning()
        .get().id
  );
});

describe("saveNote", () => {
  it("writes the Student's Note, and a second save replaces it", () => {
    saveNote(db, base.user.id, lessonIds[0], "  First thoughts  ", NOW);
    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "First thoughts",
      updatedAt: NOW.toISOString(),
    });

    saveNote(db, base.user.id, lessonIds[0], "Second thoughts", LATER);
    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "Second thoughts",
      createdAt: NOW.toISOString(),
      updatedAt: LATER.toISOString(),
    });
  });

  it("deletes the Note when the body is blank", () => {
    saveNote(db, base.user.id, lessonIds[0], "Something", NOW);

    saveNote(db, base.user.id, lessonIds[0], "   ", LATER);

    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("accepts a Note of exactly 2,000 characters", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "a".repeat(2000), NOW);

    expect(result.ok).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toHaveLength(2000);
  });

  it("refuses a Note over 2,000 characters and keeps the one already there", () => {
    saveNote(db, base.user.id, lessonIds[0], "Keep me", NOW);

    const result = saveNote(db, base.user.id, lessonIds[0], "a".repeat(2001), LATER);

    expect(result).toEqual({
      ok: false,
      error: "A note can be at most 2,000 characters.",
    });
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("Keep me");
  });
});

describe("listNotesForStudent", () => {
  it("lists only the Student's own Notes, last edited first, with where each Lesson lives", () => {
    const other = db
      .insert(schema.users)
      .values({
        name: "Other Student",
        email: "other@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();
    saveNote(db, base.user.id, lessonIds[1], "On lesson 2", NOW);
    saveNote(db, base.user.id, lessonIds[0], "On lesson 1", NOW);
    saveNote(db, other.id, lessonIds[0], "Not mine", LATER);
    saveNote(db, base.user.id, lessonIds[1], "On lesson 2, edited", LATER);

    expect(listNotesForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({
        body: "On lesson 2, edited",
        updatedAt: LATER.toISOString(),
        lessonId: lessonIds[1],
        lessonTitle: "Lesson 2",
        moduleTitle: "Basics",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      }),
      expect.objectContaining({ body: "On lesson 1", lessonId: lessonIds[0] }),
    ]);
  });
});
