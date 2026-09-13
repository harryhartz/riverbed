import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import './Capture.css';

const DRAFT_KEY = 'riverbed-draft';
const AUTOSAVE_DELAY = 1200;

export default function Capture() {
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) || '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const textareaRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Keep an unsent draft safe across a crash/closed tab — separate
  // from a committed entry, which only happens on explicit save.
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, text);
  }, [text]);

  const commit = useCallback(async body => {
    if (!body.trim()) return;
    setStatus('saving');
    try {
      await api.createEntry(body);
      localStorage.removeItem(DRAFT_KEY);
      setStatus('saved');
      setText('');
      setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      setStatus('idle');
      console.error(err);
    }
  }, []);

  const handleChange = e => {
    setText(e.target.value);
  };

  // Cmd/Ctrl+Enter commits the entry. This is the only required
  // action — nothing else stands between the cursor and saved text.
  const handleKeyDown = e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      commit(text);
    }
  };

  return (
    <div className="page capture">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Start writing."
        rows={16}
        aria-label="New journal entry"
      />
      <div className="capture-footer">
        <span className="hint">⌘/Ctrl + Enter to save</span>
        <button
          className="save-btn"
          onClick={() => commit(text)}
          disabled={!text.trim() || status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save entry'}
        </button>
      </div>
    </div>
  );
}
