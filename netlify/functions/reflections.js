import { db, migrate } from '../lib/db.js';
import { generateReflection, answerQuery } from '../lib/reflection-engine.js';

let migrated = false;
async function ensureMigrated() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

const json = (statusCode, body) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

export default async (req, context) => {
  await ensureMigrated();

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('reflections');
  const rest = parts.slice(idx + 1);

  try {
    if (req.method === 'POST' && rest[0] === 'generate') {
      const result = await generateReflection({ trigger: 'manual' });
      return json(200, result);
    }

    if (req.method === 'POST' && rest[0] === 'ask') {
      const { question } = await req.json();
      if (!question || !question.trim()) return json(400, { error: 'Question cannot be empty.' });
      const result = await answerQuery(question);
      return json(200, result);
    }

    if (req.method === 'GET' && rest[0] === 'queries') {
      const result = await db.execute(`SELECT * FROM queries ORDER BY created_at DESC LIMIT 100`);
      return json(200, result.rows.map(r => ({ ...r, cited_entry_ids: JSON.parse(r.cited_entry_ids || '[]') })));
    }

    if (req.method === 'GET' && rest.length === 0) {
      const result = await db.execute(`SELECT * FROM reflections ORDER BY created_at DESC LIMIT 100`);
      return json(200, result.rows.map(r => ({ ...r, cited_entry_ids: JSON.parse(r.cited_entry_ids || '[]') })));
    }

    if (req.method === 'PATCH' && rest.length === 1) {
      const [id] = rest;
      const { status, user_reply } = await req.json();
      const updates = [];
      const args = [];
      if (status) {
        updates.push('status = ?');
        args.push(status);
      }
      if (user_reply !== undefined) {
        updates.push('user_reply = ?');
        args.push(user_reply);
      }
      if (!updates.length) return json(400, { error: 'Nothing to update' });
      args.push(id);
      await db.execute({ sql: `UPDATE reflections SET ${updates.join(', ')} WHERE id = ?`, args });
      return json(200, { ok: true });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

export const config = {
  path: ['/api/reflections', '/api/reflections/*'],
};
