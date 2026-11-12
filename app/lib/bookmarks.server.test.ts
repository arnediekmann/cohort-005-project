import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  isBookmarked,
  listBookmarksForStudent,
  toggleBookmark,
} from "./bookmarks.server";

type TestDb = ReturnType<typeof createTestDb>;

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

describe("toggleBookmark", () => {
  it("bookmarks an unbookmarked Lesson, then removes the Bookmark", () => {
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);

    expect(toggleBookmark(db, base.user.id, lessonIds[0])).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonIds[0])).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);
  });
});

describe("listBookmarksForStudent", () => {
  it("lists only the Student's own Bookmarks, newest first, with where each Lesson lives", () => {
    const other = db
      .insert(schema.users)
      .values({
        name: "Other Student",
        email: "other@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();
    db.insert(schema.bookmarks)
      .values([
        { userId: base.user.id, lessonId: lessonIds[0], createdAt: "2026-01-01T00:00:00.000Z" },
        { userId: base.user.id, lessonId: lessonIds[1], createdAt: "2026-02-01T00:00:00.000Z" },
        { userId: other.id, lessonId: lessonIds[0], createdAt: "2026-03-01T00:00:00.000Z" },
      ])
      .run();

    const listed = listBookmarksForStudent(db, base.user.id);

    expect(listed).toEqual([
      expect.objectContaining({
        lessonId: lessonIds[1],
        lessonTitle: "Lesson 2",
        moduleTitle: "Basics",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      }),
      expect.objectContaining({ lessonId: lessonIds[0], lessonTitle: "Lesson 1" }),
    ]);
  });

  it("never lists the same Lesson twice after re-bookmarking it", () => {
    toggleBookmark(db, base.user.id, lessonIds[0]);
    toggleBookmark(db, base.user.id, lessonIds[0]);
    toggleBookmark(db, base.user.id, lessonIds[0]);

    expect(listBookmarksForStudent(db, base.user.id)).toHaveLength(1);
  });
});
