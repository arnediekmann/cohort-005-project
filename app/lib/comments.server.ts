import { eq } from "drizzle-orm";
import { comments, courses, lessons, modules, users } from "~/db/schema";
import { MAX_COMMENT_LENGTH, MIN_COMMENT_LENGTH } from "~/lib/comments";
import { toRecipient, type Notification } from "~/lib/notifier.server";
import type { Db } from "~/lib/refunds.server";

// ─── Comments ───
// Creating Discussion Questions and Discussion Replies on a lesson. See
// GLOSSARY.md for the language.

export function assertValidCommentBody(body: string) {
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }
  return trimmed;
}

/**
 * Posts a Discussion Question (no parent) or a Discussion Reply (parent is a
 * Discussion Question on the same lesson). Throws with a user-facing message
 * when the body or the parent is invalid.
 *
 * Returns one Instructor Reply Notification when the course's Instructor
 * replies to someone else's Discussion Question that is not deleted;
 * otherwise none.
 */
export function createComment(
  db: Db,
  userId: number,
  lessonId: number,
  parentId: number | null,
  body: string
) {
  const trimmed = assertValidCommentBody(body);

  const lesson = db
    .select({
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  let parent: typeof comments.$inferSelect | undefined;
  if (parentId !== null) {
    parent = db
      .select()
      .from(comments)
      .where(eq(comments.id, parentId))
      .get();
    if (!parent) {
      throw new Error("Parent comment not found");
    }
    if (parent.lessonId !== lessonId) {
      throw new Error("Parent comment belongs to a different lesson");
    }
    if (parent.parentId !== null) {
      throw new Error("Replies can only be one level deep");
    }
  }

  const comment = db
    .insert(comments)
    .values({ userId, lessonId, parentId, body: trimmed })
    .returning()
    .get();

  const notifications: Notification[] = [];
  if (
    parent &&
    parent.deletedAt === null &&
    userId === lesson.instructorId &&
    parent.userId !== userId
  ) {
    notifications.push({
      workflow: "instructor-reply",
      recipients: [toRecipient(getUser(db, parent.userId))],
      data: {
        instructorName: getUser(db, userId).name,
        courseTitle: lesson.courseTitle,
        lessonTitle: lesson.lessonTitle,
        link: `/courses/${lesson.courseSlug}/lessons/${lessonId}#comment-${parent.id}`,
      },
    });
  }

  return { comment, notifications };
}

function getUser(db: Db, userId: number) {
  const user = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}
