import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import './Timeline.css';


function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Timeline() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [recentlyDeleted, setRecentlyDeleted] = useState(null); // { id, body } for undo toast

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.listEntries();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async entry => {
    await api.deleteEntry(entry.id);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    setRecentlyDeleted(entry);
    setTimeout(() => setRecentlyDeleted(current => (current?.id === entry.id ? null : current)), 8000);
  };

  const handleUndo = async () => {
    if (!recentlyDeleted) return;
    await api.recoverEntry(recentlyDeleted.id);
    setRecentlyDeleted(null);
    load();
  };

  const toggleExclude = async entry => {
    const next = !entry.excluded_from_ai;
    await api.excludeFromAI(entry.id, next);
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, excluded_from_ai: next ? 1 : 0 } : e)));
  };

  const filtered = query.trim()
    ? entries.filter(e => e.body.toLowerCase().includes(query.trim().toLowerCase()))
    : entries;

  return (
    <div className="page timeline">
      <div className="timeline-header">
        <input
          type="text"
          placeholder="Search entries…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="search-input"
        />
        <a href={api.exportAll()} download className="export-link">
          Export all
        </a>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p className="muted empty-state">
          {query ? 'Nothing matches that search.' : 'Nothing written yet. Go start a page.'}
        </p>
      )}

      <ul className="entry-list">
        {filtered.map(entry => (
          <li key={entry.id} className="entry-item">
            <div className="entry-meta">
              <span className="entry-date">{formatDate(entry.created_at)}</span>
              <div className="entry-actions">
                <button className="text-btn" onClick={() => toggleExclude(entry)}>
                  {entry.excluded_from_ai ? 'Include in AI analysis' : 'Exclude from AI analysis'}
                </button>
                <button className="text-btn danger" onClick={() => handleDelete(entry)}>
                  Delete
                </button>
              </div>
            </div>
            <p className="entry-body">{entry.body}</p>
          </li>
        ))}
      </ul>

      {recentlyDeleted && (
        <div className="undo-toast">
          <span>Entry deleted.</span>
          <button className="text-btn" onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
