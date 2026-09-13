import { Router } from 'express';
import { db } from '../db.js';
import { currentProviderName } from '../llm/adapter.js';

export const settingsRouter = Router();

const DEFAULTS = {
  reflection_cadence: 'off', // 'off' | 'weekly' | 'monthly'
};

settingsRouter.get('/', async (req, res) => {
  const result = await db.execute(`SELECT * FROM settings`);
  const settings = { ...DEFAULTS };
  for (const row of result.rows) settings[row.key] = row.value;
  settings.llm_provider = currentProviderName();
  res.json(settings);
});

settingsRouter.put('/:key', async (req, res) => {
  const { value } = req.body;
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [req.params.key, String(value)],
  });
  res.json({ ok: true });
});

// Transparency: what would get sent to the LLM right now, if a
// reflection were generated. Lets the user see exactly what leaves
// their device before it happens.
settingsRouter.get('/ai-preview', async (req, res) => {
  const result = await db.execute(
    `SELECT id, created_at FROM entries WHERE deleted_at IS NULL AND excluded_from_ai = 0 ORDER BY created_at ASC`
  );
  res.json({
    provider: currentProviderName(),
    entry_count: result.rows.length,
    date_range: result.rows.length
      ? { from: result.rows[0].created_at, to: result.rows[result.rows.length - 1].created_at }
      : null,
    note: 'Full text of these entries (not just metadata) is sent to the configured LLM provider when a reflection is generated or a question is asked.',
  });
});
