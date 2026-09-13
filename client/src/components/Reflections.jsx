import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import './Reflections.css';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Reflections() {
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState(null); // transient status text
  const [replyDrafts, setReplyDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.listReflections();
    setReflections(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const result = await api.generateReflection();
      if (result.skipped) {
        setNotice(result.reason);
      } else {
        setNotice(null);
        await load();
      }
    } catch (err) {
      setNotice(`Something went wrong: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (id, status) => {
    await api.updateReflection(id, { status });
    setReflections(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
  };

  const submitReply = async id => {
    const reply = replyDrafts[id];
    if (!reply?.trim()) return;
    await api.updateReflection(id, { user_reply: reply, status: 'read' });
    setReflections(prev => prev.map(r => (r.id === id ? { ...r, user_reply: reply, status: 'read' } : r)));
    setReplyDrafts(prev => ({ ...prev, [id]: '' }));
  };

  return (
    <div className="page reflections">
      <div className="reflections-header">
        <p className="lede">
          A quiet re-reading of what you've written — patterns, echoes, and questions worth sitting with.
        </p>
        <button className="reflect-btn" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Reading back through it…' : 'Reflect now'}
        </button>
      </div>

      {notice && <p className="notice">{notice}</p>}

      {loading && <p className="muted">Loading…</p>}

      {!loading && reflections.length === 0 && !notice && (
        <p className="muted empty-state">No reflections yet. Write a few entries, then reflect whenever you're ready.</p>
      )}

      <ul className="reflection-list">
        {reflections.map(r => (
          <li key={r.id} className={`reflection-item status-${r.status}`}>
            <p className="reflection-body">{r.body}</p>
            <div className="reflection-meta">
              <span>{formatDate(r.created_at)}</span>
              <span>·</span>
              <span>{r.cited_entry_ids.length} entries cited</span>
              <span>·</span>
              <span>{r.trigger === 'manual' ? 'you asked' : 'scheduled'}</span>
            </div>

            <div className="reflection-actions">
              {r.status !== 'dismissed' && (
                <button className="text-btn" onClick={() => setStatus(r.id, 'dismissed')}>
                  Dismiss
                </button>
              )}
              {r.status === 'dismissed' && (
                <button className="text-btn" onClick={() => setStatus(r.id, 'unread')}>
                  Restore
                </button>
              )}
            </div>

            {r.user_reply ? (
              <p className="reflection-reply">You: {r.user_reply}</p>
            ) : (
              <div className="reply-row">
                <input
                  type="text"
                  placeholder="Reply to this…"
                  value={replyDrafts[r.id] || ''}
                  onChange={e => setReplyDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && submitReply(r.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
