import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { createComment } from "./comments.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let otherLessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  [lessonId, otherLessonId] = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("createComment", () => {
  it("posts a Discussion Question with a trimmed body", () => {
    const comment = createComment(db, base.user.id, lessonId, null, "  Why?  ");

    expect(comment).toMatchObject({
      userId: base.user.id,
      lessonId,
      parentId: null,
      body: "Why?",
    });
  });

  it("posts a Discussion Reply under a Discussion Question", () => {
    const question = createComment(db, base.user.id, lessonId, null, "Why?");

    const reply = createComment(
      db,
      base.instructor.id,
      lessonId,
      question.id,
      "Because."
    );

    expect(reply).toMatchObject({
      userId: base.instructor.id,
      lessonId,
      parentId: question.id,
      body: "Because.",
    });
  });

  it("rejects an empty body", () => {
    expect(() =>
      createComment(db, base.user.id, lessonId, null, "   ")
    ).toThrow("Comment cannot be empty");
  });

  it("rejects a body over 5000 characters", () => {
    expect(() =>
      createComment(db, base.user.id, lessonId, null, "a".repeat(5001))
    ).toThrow("Comment must be 5000 characters or fewer");
  });

  it("rejects an unknown lesson", () => {
    expect(() =>
      createComment(db, base.user.id, 9999, null, "Why?")
    ).toThrow("Lesson not found");
  });

  it("rejects an unknown parent", () => {
    expect(() =>
      createComment(db, base.user.id, lessonId, 9999, "Why?")
    ).toThrow("Parent comment not found");
  });

  it("rejects a parent on another lesson", () => {
    const question = createComment(db, base.user.id, otherLessonId, null, "Q");

    expect(() =>
      createComment(db, base.instructor.id, lessonId, question.id, "A")
    ).toThrow("Parent comment belongs to a different lesson");
  });

  it("keeps replies one level deep", () => {
    const question = createComment(db, base.user.id, lessonId, null, "Q");
    const reply = createComment(db, base.instructor.id, lessonId, question.id, "A");

    expect(() =>
      createComment(db, base.user.id, lessonId, reply.id, "A to A")
    ).toThrow("Replies can only be one level deep");
  });
});
