import { db } from './db.js';
import { chat } from './llm/adapter.js';
import { nanoid } from 'nanoid';

// --- The reflection system prompt ---
//
// This is the single most important piece of text in the app (per
// your spec). Every instruction here exists to enforce one rule:
// notice and ask, never diagnose or conclude. Tune this file, not
// scattered strings elsewhere, if the tone ever drifts.

const REFLECTION_SYSTEM_PROMPT = `You are reading a private journal on behalf of the person who wrote it — someone who trusts this app with unfiltered, unedited thoughts. Your only job is to notice patterns across entries and ask about them. You are not a therapist, not a psychiatrist, not an authority, and you never diagnose or conclude "you are X."

Rules, non-negotiable:
1. Never state a conclusion about who the person is or what's wrong with them. Never use phrasing like "You are experiencing," "This suggests you have," or "This is a sign of."
2. Every observation must be phrased as a specific, curious question or a gentle, tentative noticing — the way a sharp, caring friend would, not a report.
3. Every claim must cite the specific entries it's drawn from, by their id, so the person can verify it themselves. Do not make claims you can't point to.
4. Prefer patterns that span a long time (weeks or months apart) over ones from a single recent cluster — the far-apart echoes are usually the more interesting ones.
5. Actively look for genuine irony or contradiction — a stated intention versus a later action or feeling, two incompatible beliefs expressed at different times, a gap between how someone describes themselves and what they actually write about. Surface these as open questions, never as accusations or "gotchas."
6. If you are not confident a pattern is real, say so plainly, or don't surface it at all. Under-claiming is always safer than over-claiming.
7. Keep it short. One pattern, clearly stated, beats three vague ones.
8. Never use clinical or diagnostic vocabulary (anxiety, depression, trauma, etc.) unless the person's own words used that vocabulary first — and even then, reflect their word back rather than asserting it as a fact about them.

Output format: respond with a JSON object only, no other text:
{
  "reflection": "the reflection text, 2-4 sentences, in second person, ending with a genuine question where appropriate",
  "cited_entry_ids": ["id1", "id2", ...]
}

If you find no pattern worth surfacing in this window, respond with:
{ "reflection": null, "cited_entry_ids": [] }`;

function buildWindowPrompt(entries) {
  const formatted = entries
    .map(e => `[id: ${e.id}] [${e.created_at}]\n${e.body}`)
    .join('\n\n---\n\n');

  return `Here are journal entries from the window under consideration, oldest first. Look across all of them for a pattern, echo, or contradiction worth gently asking about.

${formatted}`;
}

/**
 * Pull a window of entries for reflection. Defaults to everything
 * not excluded from AI analysis and not soft-deleted — deliberately
 * wide, since the spec calls out that far-apart connections matter
 * most, and a narrow recent window would miss them.
 */
async function getEntryWindow({ sinceDate = null, limit = 500 } = {}) {
  let sql = `SELECT id, body, created_at FROM entries
             WHERE deleted_at IS NULL AND excluded_from_ai = 0`;
  const args = [];
  if (sinceDate) {
    sql += ` AND created_at >= ?`;
    args.push(sinceDate);
  }
  sql += ` ORDER BY created_at ASC LIMIT ?`;
  args.push(limit);

  const result = await db.execute({ sql, args });
  return result.rows;
}

/**
 * Generate a reflection right now, on demand or on schedule.
 * Returns the stored reflection row, or null if nothing was surfaced.
 */
export async function generateReflection({ trigger = 'manual' } = {}) {
  const entries = await getEntryWindow();

  if (entries.length < 3) {
    return { skipped: true, reason: 'Not enough entries yet to find a pattern (need at least 3).' };
  }

  const userPrompt = buildWindowPrompt(entries);
  const raw = await chat(REFLECTION_SYSTEM_PROMPT, userPrompt);

  let parsed;
  try {
    const cleaned = raw.trim().replace(/^```json\s*|```$/g, '');
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${raw.slice(0, 300)}`);
  }

  if (!parsed.reflection) {
    return { skipped: true, reason: 'No pattern found worth surfacing in this window.' };
  }

  const id = nanoid();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO reflections
          (id, body, cited_entry_ids, status, window_start, window_end, trigger, created_at)
          VALUES (?, ?, ?, 'unread', ?, ?, ?, ?)`,
    args: [
      id,
      parsed.reflection,
      JSON.stringify(parsed.cited_entry_ids || []),
      entries[0].created_at,
      entries[entries.length - 1].created_at,
      trigger,
      now,
    ],
  });

  return {
    skipped: false,
    reflection: {
      id,
      body: parsed.reflection,
      cited_entry_ids: parsed.cited_entry_ids || [],
      trigger,
      created_at: now,
    },
  };
}

// --- Ad-hoc Q&A over history ---

const QUERY_SYSTEM_PROMPT = `You are answering a question the person is asking about their own journal history. Answer only from the entries provided — do not speculate beyond them. If the entries don't contain an answer, say so plainly rather than guessing. Cite the specific entry ids your answer draws from. Never diagnose or generalize about the person's character; describe only what they actually wrote.

Output format: JSON only:
{ "answer": "your answer, in second person, grounded in what's actually in the entries", "cited_entry_ids": ["id1", "id2", ...] }`;

export async function answerQuery(question) {
  const entries = await getEntryWindow();
  const userPrompt = `Question: "${question}"\n\nJournal entries to search, oldest first:\n\n${buildWindowPrompt(entries).split('\n\n')[0] === '' ? '' : ''}${entries
    .map(e => `[id: ${e.id}] [${e.created_at}]\n${e.body}`)
    .join('\n\n---\n\n')}`;

  const raw = await chat(QUERY_SYSTEM_PROMPT, userPrompt);
  let parsed;
  try {
    const cleaned = raw.trim().replace(/^```json\s*|```$/g, '');
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${raw.slice(0, 300)}`);
  }

  const id = nanoid();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO queries (id, question, answer, cited_entry_ids, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, question, parsed.answer, JSON.stringify(parsed.cited_entry_ids || []), now],
  });

  return {
    id,
    question,
    answer: parsed.answer,
    cited_entry_ids: parsed.cited_entry_ids || [],
    created_at: now,
  };
}
