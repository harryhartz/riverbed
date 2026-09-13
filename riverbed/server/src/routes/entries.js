import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';

export const entriesRouter = Router();

// Create — frictionless: only `body` is required. No forced fields.
entriesRouter.post('/', async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Entry body cannot be empty.' });
  }

  const id = nanoid();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO entries (id, body, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    args: [id, body, now, now],
  });

  res.status(201).json({ id, body, created_at: now, updated_at: now });
});

// List — chronological, excludes soft-deleted by default.
entriesRouter.get('/', async (req, res) => {
  const { includeDeleted, limit = 200, before } = req.query;

  let sql = `SELECT * FROM entries WHERE 1=1`;
  const args = [];

  if (!includeDeleted) {
    sql += ` AND deleted_at IS NULL`;
  }
  if (before) {
    sql += ` AND created_at < ?`;
    args.push(before);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(Number(limit));

  const result = await db.execute({ sql, args });
  res.json(result.rows);
});

// Get one
entriesRouter.get('/:id', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT * FROM entries WHERE id = ?`,
    args: [req.params.id],
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// Edit — note: the ORIGINAL body is never overwritten in place without
// trace. For simplicity in this first version we do allow correcting a
// typo by direct update, but we stamp updated_at so edits are visible.
// (A future version could keep a revision history table if you want
// true immutability enforcement rather than just transparency.)
entriesRouter.patch('/:id', async (req, res) => {
  const { body } = req.body;
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE entries SET body = ?, updated_at = ? WHERE id = ?`,
    args: [body, now, req.params.id],
  });
  res.json({ ok: true });
});

// Soft delete — recoverable, not destroyed.
entriesRouter.delete('/:id', async (req, res) => {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE entries SET deleted_at = ? WHERE id = ?`,
    args: [now, req.params.id],
  });
  res.json({ ok: true, recoverable: true });
});

// Recover a soft-deleted entry.
entriesRouter.post('/:id/recover', async (req, res) => {
  await db.execute({
    sql: `UPDATE entries SET deleted_at = NULL WHERE id = ?`,
    args: [req.params.id],
  });
  res.json({ ok: true });
});

// Exclude/include from future AI analysis — without deleting the entry.
entriesRouter.post('/:id/exclude-from-ai', async (req, res) => {
  const { excluded } = req.body; // boolean
  await db.execute({
    sql: `UPDATE entries SET excluded_from_ai = ? WHERE id = ?`,
    args: [excluded ? 1 : 0, req.params.id],
  });
  res.json({ ok: true });
});

// Tags for an entry
entriesRouter.get('/:id/tags', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT * FROM tags WHERE entry_id = ?`,
    args: [req.params.id],
  });
  res.json(result.rows);
});

entriesRouter.post('/:id/tags', async (req, res) => {
  const { kind, value, source = 'user' } = req.body;
  const id = nanoid();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO tags (id, entry_id, kind, value, source, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, req.params.id, kind, value, source, now],
  });
  res.status(201).json({ id, kind, value, source, created_at: now });
});

// Full raw export — open, human-readable, portable. Per spec: no lock-in.
entriesRouter.get('/export/all', async (req, res) => {
  const entries = await db.execute(`SELECT * FROM entries ORDER BY created_at ASC`);
  const tags = await db.execute(`SELECT * FROM tags`);
  const reflections = await db.execute(`SELECT * FROM reflections ORDER BY created_at ASC`);
  const links = await db.execute(`SELECT * FROM entry_links`);

  const exportData = {
    exported_at: new Date().toISOString(),
    format_version: 1,
    entries: entries.rows,
    tags: tags.rows,
    reflections: reflections.rows.map(r => ({
      ...r,
      cited_entry_ids: JSON.parse(r.cited_entry_ids || '[]'),
    })),
    entry_links: links.rows,
  };

  res.setHeader('Content-Disposition', 'attachment; filename="riverbed-export.json"');
  res.json(exportData);
});
