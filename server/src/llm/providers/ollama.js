// Local Ollama provider — for fully offline use or if all hosted free
// tiers are exhausted. Requires Ollama running locally
// (https://ollama.com), e.g. `ollama pull llama3.1` then `ollama serve`.

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.1';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

export async function chat(systemPrompt, userPrompt) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama chat error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.message?.content ?? '';
}

export async function embed(text) {
  const res = await fetch(`${BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embed error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.embedding ?? [];
}
