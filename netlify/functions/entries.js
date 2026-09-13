import { db, migrate } from '../lib/db.js';
import { nanoid } from 'nanoid';
import { uploadImage } from '../lib/cloudinary.js';

let migrated = false;
async function ensureMigrated() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

export default async (req, context) => {
  await ensureMigrated();

  const url = new URL(req.url);
  // Path shape: /.netlify/functions/entries/<id?>/<action?>
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('entries');
  const rest = parts.slice(idx + 1); // [] | [id] | [id, action] | ['export','all']

  try {
    if (req.method === 'GET' && rest[0] === 'export' && rest[1] === 'all') {
      return await exportAll();
    }

    if (req.method === 'GET' && rest[0] === 'links' && rest.length === 1) {
      return await listAllLinks();
    }

    if (req.method === 'POST' && rest.length === 0) {
      return await createEntry(req);
    }

    if (req.method === 'GET' && rest.length === 0) {
      return await listEntries(url);
    }

    if (rest.length === 1) {
      const [id] = rest;
      if (req.method === 'GET') return await getEntry(id);
      if (req.method === 'PATCH') return await updateEntry(id, req);
      if (req.method === 'DELETE') return await softDeleteEntry(id);
    }

    if (rest.length === 2) {
      const [id, action] = rest;
      if (action === 'recover' && req.method === 'POST') return await recoverEntry(id);
      if (action === 'exclude-from-ai' && req.method === 'POST') return await excludeFromAI(id, req);
      if (action === 'tags' && req.method === 'GET') return await listTags(id);
      if (action === 'tags' && req.method === 'POST') return await addTag(id, req);
      if (action === 'attachments' && req.method === 'POST') return await addAttachment(id, req);
      if (action === 'attachments' && req.method === 'GET') return await listAttachments(id);
      if (action === 'links' && req.method === 'GET') return await listLinksForEntry(id);
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

async function createEntry(req) {
  const { body = '', kind = 'text' } = await req.json();
  // Body may be empty — a standalone image post creates the entry
  // first (empty body) then attaches a photo in a follow-up request.
  // The client is responsible for not calling this with neither text
  // nor a pending photo (see Capture.jsx's commit() guard).
  const id = nanoid();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO entries (id, body, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    args: [id, body, kind, now, now],
  });

  return json(201, { id, body, kind, created_at: now, updated_at: now });
}

async function listEntries(url) {
  const includeDeleted = url.searchParams.get('includeDeleted');
  const limit = Number(url.searchParams.get('limit') || 200);
  const before = url.searchParams.get('before');
  const kind = url.searchParams.get('kind');

  let sql = `SELECT * FROM entries WHERE 1=1`;
  const args = [];

  if (!includeDeleted) sql += ` AND deleted_at IS NULL`;
  if (before) {
    sql += ` AND created_at < ?`;
    args.push(before);
  }
  if (kind) {
    sql += ` AND kind = ?`;
    args.push(kind);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(limit);

  const result = await db.execute({ sql, args });

  // Attach photo URLs inline so the client doesn't need N follow-up calls.
  const entries = result.rows;
  if (entries.length) {
    const ids = entries.map(e => e.id);
    const placeholders = ids.map(() => '?').join(',');
    const attResult = await db.execute({
      sql: `SELECT * FROM attachments WHERE entry_id IN (${placeholders})`,
      args: ids,
    });
    const byEntry = {};
    for (const a of attResult.rows) {
      (byEntry[a.entry_id] ||= []).push(a);
    }
    for (const e of entries) {
      e.attachments = byEntry[e.id] || [];
    }
  }

  return json(200, entries);
}

async function getEntry(id) {
  const result = await db.execute({ sql: `SELECT * FROM entries WHERE id = ?`, args: [id] });
  if (!result.rows.length) return json(404, { error: 'Not found' });
  const entry = result.rows[0];
  const att = await db.execute({ sql: `SELECT * FROM attachments WHERE entry_id = ?`, args: [id] });
  entry.attachments = att.rows;
  return json(200, entry);
}

async function updateEntry(id, req) {
  const { body } = await req.json();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE entries SET body = ?, updated_at = ? WHERE id = ?`,
    args: [body, now, id],
  });
  return json(200, { ok: true });
}

async function softDeleteEntry(id) {
  const now = new Date().toISOString();
  await db.execute({ sql: `UPDATE entries SET deleted_at = ? WHERE id = ?`, args: [now, id] });
  return json(200, { ok: true, recoverable: true });
}

async function recoverEntry(id) {
  await db.execute({ sql: `UPDATE entries SET deleted_at = NULL WHERE id = ?`, args: [id] });
  return json(200, { ok: true });
}

async function excludeFromAI(id, req) {
  const { excluded } = await req.json();
  await db.execute({
    sql: `UPDATE entries SET excluded_from_ai = ? WHERE id = ?`,
    args: [excluded ? 1 : 0, id],
  });
  return json(200, { ok: true });
}

async function listTags(id) {
  const result = await db.execute({ sql: `SELECT * FROM tags WHERE entry_id = ?`, args: [id] });
  return json(200, result.rows);
}

async function addTag(id, req) {
  const { kind, value, source = 'user' } = await req.json();
  const tagId = nanoid();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO tags (id, entry_id, kind, value, source, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [tagId, id, kind, value, source, now],
  });
  return json(201, { id: tagId, kind, value, source, created_at: now });
}

async function listAttachments(id) {
  const result = await db.execute({ sql: `SELECT * FROM attachments WHERE entry_id = ?`, args: [id] });
  return json(200, result.rows);
}

async function addAttachment(id, req) {
  const { dataUrl } = await req.json();
  if (!dataUrl) return json(400, { error: 'dataUrl is required (base64 image data).' });

  const uploaded = await uploadImage(dataUrl);
  const attId = nanoid();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO attachments (id, entry_id, url, public_id, width, height, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [attId, id, uploaded.url, uploaded.public_id, uploaded.width || null, uploaded.height || null, now],
  });

  return json(201, { id: attId, entry_id: id, url: uploaded.url, width: uploaded.width, height: uploaded.height, created_at: now });
}

async function listLinksForEntry(id) {
  const result = await db.execute({
    sql: `SELECT * FROM entry_links WHERE entry_id_a = ? OR entry_id_b = ?`,
    args: [id, id],
  });
  return json(200, result.rows);
}

async function listAllLinks() {
  const result = await db.execute(`SELECT * FROM entry_links`);
  return json(200, result.rows);
}

async function exportAll() {
  const entries = await db.execute(`SELECT * FROM entries ORDER BY created_at ASC`);
  const attachments = await db.execute(`SELECT * FROM attachments`);
  const tags = await db.execute(`SELECT * FROM tags`);
  const reflections = await db.execute(`SELECT * FROM reflections ORDER BY created_at ASC`);
  const links = await db.execute(`SELECT * FROM entry_links`);

  const exportData = {
    exported_at: new Date().toISOString(),
    format_version: 2,
    entries: entries.rows,
    attachments: attachments.rows,
    tags: tags.rows,
    reflections: reflections.rows.map(r => ({
      ...r,
      cited_entry_ids: JSON.parse(r.cited_entry_ids || '[]'),
    })),
    entry_links: links.rows,
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="riverbed-export.json"',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(exportData),
  };
}

export const config = {
  path: ['/api/entries', '/api/entries/*'],
};
