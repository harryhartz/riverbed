// Anthropic provider. Not free-tier for sustained use, but kept here
// so the app can switch to it for a session with zero code changes
// (e.g. if you want a higher-quality one-off reflection pass).

const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-6';

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  return key;
}

export async function chat(systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic chat error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content?.find(b => b.type === 'text')?.text ?? '';
}

export async function embed() {
  throw new Error(
    'Anthropic does not offer an embeddings API. Use a different provider for embed(), ' +
    'or configure EMBED_PROVIDER separately from LLM_PROVIDER.'
  );
}
