const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Entries
  createEntry: body => request('/entries', { method: 'POST', body: JSON.stringify({ body }) }),
  listEntries: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/entries${qs ? `?${qs}` : ''}`);
  },
  getEntry: id => request(`/entries/${id}`),
  updateEntry: (id, body) => request(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  deleteEntry: id => request(`/entries/${id}`, { method: 'DELETE' }),
  recoverEntry: id => request(`/entries/${id}/recover`, { method: 'POST' }),
  excludeFromAI: (id, excluded) =>
    request(`/entries/${id}/exclude-from-ai`, { method: 'POST', body: JSON.stringify({ excluded }) }),
  exportAll: () => `${BASE}/entries/export/all`,

  // Reflections
  generateReflection: () => request('/reflections/generate', { method: 'POST' }),
  listReflections: () => request('/reflections'),
  updateReflection: (id, patch) => request(`/reflections/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  ask: question => request('/reflections/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  listQueries: () => request('/reflections/queries'),

  // Settings
  getSettings: () => request('/settings'),
  setSetting: (key, value) => request(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  aiPreview: () => request('/settings/ai-preview'),
};
