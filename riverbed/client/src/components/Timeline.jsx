import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api.js';
import './Timeline.css';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Timeline() {
  const [entries, setEntries] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [recentlyDeleted, setRecentlyDeleted] = useState(null);
  const [openConnection, setOpenConnection] = useState(null); // entry id whose links are expanded

  const load = useCallback(async () => {
    setLoading(true);
    const [entryData, linkData] = await Promise.all([api.listEntries(), api.listAllLinks()]);
    setEntries(entryData);
    setLinks(linkData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const linksByEntry = useMemo(() => {
    const map = {};
    for (const link of links) {
      (map[link.entry_id_a] ||= []).push({ ...link, otherId: link.entry_id_b });
      (map[link.entry_id_b] ||= []).push({ ...link, otherId: link.entry_id_a });
    }
    return map;
  }, [links]);

  const entryById = useMemo(() => {
    const map = {};
    for (const e of entries) map[e.id] = e;
    return map;
  }, [entries]);

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
        {filtered.map((entry, i) => {
          const entryLinks = linksByEntry[entry.id] || [];
          const isOpen = openConnection === entry.id;
          return (
            <li key={entry.id} className="entry-item">
              <div className="spine-rail">
                <span className="spine-line" aria-hidden="true" />
                <span className="spine-dot" aria-hidden="true" />
              </div>

              <div className="entry-content">
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

                {entry.body && <p className="entry-body">{entry.body}</p>}

                {entry.attachments?.length > 0 && (
                  <div className="entry-photos">
                    {entry.attachments.map(a => (
                      <img key={a.id} src={a.url} alt="" className="entry-photo" />
                    ))}
                  </div>
                )}

                {entryLinks.length > 0 && (
                  <div className="connection-block">
                    <button className="connection-toggle" onClick={() => setOpenConnection(isOpen ? null : entry.id)}>
                      <svg width="14" height="14" viewBox="0 0 14 14" className="root-icon" aria-hidden="true">
                        <path d="M7 1 C4 4, 10 6, 7 9 C4 12, 10 12, 11 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      {entryLinks.length} connection{entryLinks.length > 1 ? 's' : ''}
                    </button>
                    {isOpen && (
                      <ul className="connection-list">
                        {entryLinks.map(link => {
                          const other = entryById[link.otherId];
                          if (!other) return null;
                          return (
                            <li key={link.id} className="connection-item">
                              <span className="connection-relation">{link.relation}</span>
                              <span className="connection-date">{formatDate(other.created_at)}</span>
                              <p className="connection-snippet">{other.body?.slice(0, 140)}{other.body?.length > 140 ? '…' : ''}</p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
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
