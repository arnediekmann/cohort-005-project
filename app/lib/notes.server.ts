import { and, desc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { courses, lessons, modules, notes } from "~/db/schema";
import { z } from "zod";

// ─── Notes ───
// A Student's own plain-text writing about a Lesson, private to them. See
// GLOSSARY.md for the language.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

export type Db = BetterSQLite3Database<typeof schema>;

type Note = typeof notes.$inferSelect;

// The cap the spec sets (#25). Plain text, trimmed; never rendered as Markdown.
const noteBodySchema = z
  .string()
  .trim()
  .max(2000, "A note can be at most 2,000 characters.");

export type SaveNoteResult =
  | { ok: true; note: Note | null }
  | { ok: false; error: string };

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

/**
 * Writes the Student's Note on the Lesson, replacing the one already there. A
 * blank body hard-deletes the Note; there is no undo.
 */
export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const parsed = noteBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const trimmed = parsed.data;

  if (trimmed.length === 0) {
    db.delete(notes)
      .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
      .run();
    return { ok: true, note: null };
  }

  const at = now.toISOString();
  const existing = getNote(db, userId, lessonId);

  const note = existing
    ? db
        .update(notes)
        .set({ body: trimmed, updatedAt: at })
        .where(eq(notes.id, existing.id))
        .returning()
        .get()
    : db
        .insert(notes)
        .values({ userId, lessonId, body: trimmed, createdAt: at, updatedAt: at })
        .returning()
        .get();

  return { ok: true, note };
}

/** The Student's Notes, last edited first, with the Lesson, Module and Course each one sits in. */
export function listNotesForStudent(db: Db, userId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt))
    .all();
}
