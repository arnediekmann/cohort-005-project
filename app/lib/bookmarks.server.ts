import { and, desc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules } from "~/db/schema";

// ─── Bookmarks ───
// A Student's private flag on a Lesson. See GLOSSARY.md for the language.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

export type Db = BetterSQLite3Database<typeof schema>;

export function isBookmarked(db: Db, userId: number, lessonId: number) {
  return !!getBookmark(db, userId, lessonId);
}

function getBookmark(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)))
    .get();
}

/** Bookmarks the Lesson, or removes the Bookmark if there is one. Returns whether it is now bookmarked. */
export function toggleBookmark(db: Db, userId: number, lessonId: number) {
  const existing = getBookmark(db, userId, lessonId);

  if (existing) {
    db.delete(bookmarks).where(eq(bookmarks.id, existing.id)).run();
    return false;
  }

  db.insert(bookmarks).values({ userId, lessonId }).run();
  return true;
}

/** The Student's Bookmarks, newest first, with the Lesson, Module and Course each one sits in. */
export function listBookmarksForStudent(db: Db, userId: number) {
  return db
    .select({
      id: bookmarks.id,
      createdAt: bookmarks.createdAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .all();
}
