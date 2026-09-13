import { useState, useRef, useEffect, useCallback } from 'react';
import { api, fileToDataUrl } from '../api.js';
import './Capture.css';

const DRAFT_KEY = 'riverbed-draft';
const MIN_ROWS = 3;

export default function Capture() {
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) || '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl }
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, text);
  }, [text]);

  // Auto-expand: start small (MIN_ROWS), grow to fit content as the
  // person writes, rather than opening on a big intimidating box.
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [text, resize]);

  const commit = useCallback(async (body, image) => {
    if (!body.trim() && !image) return;
    setStatus('saving');
    try {
      const entry = await api.createEntry(body || '');
      if (image) {
        const dataUrl = await fileToDataUrl(image.file);
        await api.addAttachment(entry.id, dataUrl);
      }
      localStorage.removeItem(DRAFT_KEY);
      setStatus('saved');
      setText('');
      setPendingImage(null);
      setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      setStatus('idle');
      console.error(err);
    }
  }, []);

  const handleKeyDown = e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      commit(text, pendingImage);
    }
  };

  const handleFileSelect = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  };

  return (
    <div className="page capture">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={pendingImage ? 'Add a caption, or leave it be.' : 'Start writing.'}
        rows={MIN_ROWS}
        aria-label="New journal entry"
        className="capture-textarea"
      />

      {pendingImage && (
        <div className="pending-image">
          <img src={pendingImage.previewUrl} alt="Attached preview" />
          <button className="text-btn danger" onClick={removePendingImage}>
            Remove photo
          </button>
        </div>
      )}

      <div className="capture-footer">
        <div className="capture-footer-left">
          <button
            className="icon-btn"
            title="Attach a photo"
            onClick={() => fileInputRef.current?.click()}
          >
            + photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileSelect}
          />
          <span className="hint">Cmd/Ctrl + Enter to save</span>
        </div>
        <button
          className="save-btn"
          onClick={() => commit(text, pendingImage)}
          disabled={(!text.trim() && !pendingImage) || status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save entry'}
        </button>
      </div>
    </div>
  );
}
