import { db, migrate } from '../lib/db.js';
import { currentProviderName } from '../lib/llm/adapter.js';

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

const DEFAULTS = { reflection_cadence: 'off' };

export default async (req, context) => {
  await ensureMigrated();

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('settings');
  const rest = parts.slice(idx + 1);

  try {
    if (req.method === 'GET' && rest[0] === 'ai-preview') {
      const result = await db.execute(
        `SELECT id, created_at FROM entries WHERE deleted_at IS NULL AND excluded_from_ai = 0 ORDER BY created_at ASC`
      );
      return json(200, {
        provider: currentProviderName(),
        entry_count: result.rows.length,
        date_range: result.rows.length
          ? { from: result.rows[0].created_at, to: result.rows[result.rows.length - 1].created_at }
          : null,
        note: 'Full text of these entries (not just metadata) is sent to the configured LLM provider when a reflection is generated or a question is asked.',
      });
    }

    if (req.method === 'GET' && rest.length === 0) {
      const result = await db.execute(`SELECT * FROM settings`);
      const settings = { ...DEFAULTS };
      for (const row of result.rows) settings[row.key] = row.value;
      settings.llm_provider = currentProviderName();
      return json(200, settings);
    }

    if (req.method === 'PUT' && rest.length === 1) {
      const [key] = rest;
      const { value } = await req.json();
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, String(value)],
      });
      return json(200, { ok: true });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

export const config = {
  path: ['/api/settings', '/api/settings/*'],
};
