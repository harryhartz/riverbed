// Google Gemini provider, via the OpenAI-compatible endpoint so the
// request shape stays similar across providers.
//
// Requires GEMINI_API_KEY in .env. Uses Gemini's chat-completions
// compatible route: https://generativelanguage.googleapis.com/v1beta/openai/

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.6-flash';
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

export async function chat(systemPrompt, userPrompt) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini chat error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function embed(text) {
  // Gemini's native embedding endpoint (not the OpenAI-compat layer,
  // which doesn't cover embeddings the same way).
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini embed error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.embedding?.values ?? [];
}
