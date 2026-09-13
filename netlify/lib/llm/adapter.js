// Provider-agnostic LLM adapter.
//
// The rest of the app (reflection-engine.js, routes/*) only ever calls
// these three functions. Swapping providers means changing
// LLM_PROVIDER in .env — no other code changes.
//
// Add a new provider by implementing { chat, embed } in
// llm/providers/<name>.js and registering it in the map below.

import * as gemini from './providers/gemini.js';
import * as anthropic from './providers/anthropic.js';
import * as ollama from './providers/ollama.js';

const PROVIDERS = { gemini, anthropic, ollama };

function activeProvider() {
  const name = process.env.LLM_PROVIDER || 'gemini';
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown LLM_PROVIDER "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return provider;
}

/**
 * Send a single-turn chat completion request.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>} raw text response
 */
export async function chat(systemPrompt, userPrompt) {
  return activeProvider().chat(systemPrompt, userPrompt);
}

/**
 * Get an embedding vector for a piece of text.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  return activeProvider().embed(text);
}

export function currentProviderName() {
  return process.env.LLM_PROVIDER || 'gemini';
}
