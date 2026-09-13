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
  createEntry: (body, kind = 'text') =>
    request('/entries', { method: 'POST', body: JSON.stringify({ body, kind }) }),
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

  // Attachments — dataUrl is a base64 data: URL from a file input / camera
  addAttachment: (entryId, dataUrl) =>
    request(`/entries/${entryId}/attachments`, { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  listAttachments: entryId => request(`/entries/${entryId}/attachments`),
  listAllLinks: () => request('/entries/links'),

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

/** Read a File (from an <input type="file"> or drop) as a base64 data URL. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

