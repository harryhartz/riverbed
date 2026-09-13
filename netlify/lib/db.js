import { createClient } from '@libsql/client';

// Turso (libsql) client. Works identically against a local SQLite file
// (set TURSO_DATABASE_URL="file:./riverbed.db") or a hosted Turso DB
// (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). This is the only place
// that needs to change if you ever move providers.
export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./riverbed.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

// --- Schema ---
//
// Design principle (per spec): the entry's raw text is immutable and
// sacred. Everything the AI generates — tags, themes, embeddings,
// reflections, links between entries — lives in separate tables that
// reference the entry by id. Nothing ever mutates `entries.body`.
//
// Soft delete: entries are never hard-deleted by user action. A
// `deleted_at` timestamp hides them from normal views; a recovery
// window (handled at the application layer) allows undo. Hard delete
// only happens via an explicit, separate purge path (not exposed by
// default in the API).
//
// `kind` distinguishes a normal written entry from a standalone image
// post (body may be empty for the latter, with an optional caption).
// Both are still "entries" — same table, same soft-delete/AI-exclude/
// export behavior — because a standalone photo is still a moment worth
// keeping alongside written thoughts, just captured differently.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entries (
  id            TEXT PRIMARY KEY,
  body          TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image'
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  excluded_from_ai INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_entries_kind ON entries(kind);

-- Photos attached to an entry (a written entry with a photo, or a
-- standalone image post). One entry can carry more than one photo.
-- Only the Cloudinary URL + its public_id (for later deletion) are
-- stored here — the binary itself lives in Cloudinary, not this DB.
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL REFERENCES entries(id),
  url           TEXT NOT NULL,
  public_id     TEXT NOT NULL,   -- Cloudinary public_id, needed to delete later
  width         INTEGER,
  height        INTEGER,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON attachments(entry_id);

-- Auto-inferred or user-added lightweight tags. Never required at
-- write time; can be populated later by the AI pass or by the user.
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  entry_id    TEXT NOT NULL REFERENCES entries(id),
  kind        TEXT NOT NULL,   -- 'mood' | 'topic' | 'person' | 'custom'
  value       TEXT NOT NULL,
  source      TEXT NOT NULL,   -- 'user' | 'ai'
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_entry_id ON tags(entry_id);
CREATE INDEX IF NOT EXISTS idx_tags_kind_value ON tags(kind, value);

-- Embeddings for semantic search / connection-finding. Stored as
-- JSON-encoded float arrays for portability (works with any vector
-- backend later; no vendor-specific vector column needed at this scale).
CREATE TABLE IF NOT EXISTS embeddings (
  entry_id    TEXT PRIMARY KEY REFERENCES entries(id),
  model       TEXT NOT NULL,
  vector      TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- AI-drawn connections between two entries (e.g. recurring theme,
-- contradiction, echo months apart). Kept distinct from reflections
-- so the "connection web" view can query this directly.
CREATE TABLE IF NOT EXISTS entry_links (
  id            TEXT PRIMARY KEY,
  entry_id_a    TEXT NOT NULL REFERENCES entries(id),
  entry_id_b    TEXT NOT NULL REFERENCES entries(id),
  relation      TEXT NOT NULL,  -- short label, e.g. 'echo', 'contradiction', 'theme:work'
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entry_links_a ON entry_links(entry_id_a);
CREATE INDEX IF NOT EXISTS idx_entry_links_b ON entry_links(entry_id_b);

-- Reflections are first-class, persistent objects (per spec — not
-- transient popups). Each cites the entries it's drawn from so the
-- user can verify the pattern themselves.
CREATE TABLE IF NOT EXISTS reflections (
  id            TEXT PRIMARY KEY,
  body          TEXT NOT NULL,
  cited_entry_ids TEXT NOT NULL,  -- JSON array of entry ids
  status        TEXT NOT NULL DEFAULT 'unread', -- 'unread'|'read'|'dismissed'
  user_reply    TEXT,
  window_start  TEXT NOT NULL,   -- date range of entries considered
  window_end    TEXT NOT NULL,
  trigger       TEXT NOT NULL,   -- 'manual' | 'scheduled'
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reflections_created_at ON reflections(created_at);

-- Ad-hoc Q&A history ("have I talked about quitting my job before?").
-- Stored so past questions/answers are browsable, same traceability
-- principle as reflections.
CREATE TABLE IF NOT EXISTS queries (
  id              TEXT PRIMARY KEY,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  cited_entry_ids TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- App-level settings: reflection cadence, active LLM provider, etc.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export async function migrate() {
  // executeMultiple() runs the whole raw SQL blob directly through
  // libsql's multi-statement exec path. Both execute() (one at a
  // time) and batch() (array of statements) trip a known bug in the
  // local file-mode driver on certain DDL ("SQLITE_OK: not an error",
  // a mis-mapped success code — see tursodatabase/libsql-client-ts
  // issues). executeMultiple sidesteps it and is the documented way
  // to run a schema file in one shot.
  await db.executeMultiple(SCHEMA);
  console.log('✓ schema migrated');
}
