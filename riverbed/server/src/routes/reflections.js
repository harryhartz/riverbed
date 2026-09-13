import { Router } from 'express';
import { db } from '../db.js';
import { generateReflection, answerQuery } from '../reflection-engine.js';

export const reflectionsRouter = Router();

// The "Reflect now" button — generate on demand.
reflectionsRouter.post('/generate', async (req, res) => {
  try {
    const result = await generateReflection({ trigger: 'manual' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List past reflections — first-class, persistent, browsable.
reflectionsRouter.get('/', async (req, res) => {
  const result = await db.execute(
    `SELECT * FROM reflections ORDER BY created_at DESC LIMIT 100`
  );
  res.json(
    result.rows.map(r => ({
      ...r,
      cited_entry_ids: JSON.parse(r.cited_entry_ids || '[]'),
    }))
  );
});

// React to / reply to / dismiss a reflection.
reflectionsRouter.patch('/:id', async (req, res) => {
  const { status, user_reply } = req.body;
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
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  args.push(req.params.id);
  await db.execute({
    sql: `UPDATE reflections SET ${updates.join(', ')} WHERE id = ?`,
    args,
  });
  res.json({ ok: true });
});

// Ad-hoc question over history.
reflectionsRouter.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question cannot be empty.' });
  }
  try {
    const result = await answerQuery(question);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

reflectionsRouter.get('/queries', async (req, res) => {
  const result = await db.execute(
    `SELECT * FROM queries ORDER BY created_at DESC LIMIT 100`
  );
  res.json(
    result.rows.map(r => ({ ...r, cited_entry_ids: JSON.parse(r.cited_entry_ids || '[]') }))
  );
});
