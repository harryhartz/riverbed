import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import './Settings.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api.getSettings(), api.aiPreview()]);
    setSettings(s);
    setPreview(p);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCadence = async e => {
    const value = e.target.value;
    await api.setSetting('reflection_cadence', value);
    setSettings(prev => ({ ...prev, reflection_cadence: value }));
  };

  if (!settings) return <div className="page">Loading…</div>;

  return (
    <div className="page settings">
      <section className="settings-section">
        <h2>Reflection cadence</h2>
        <p className="section-note">
          The "Reflect now" button on the Reflections page always works, regardless of this setting. This only
          controls whether reflections also happen automatically in the background.
        </p>
        <select value={settings.reflection_cadence} onChange={handleCadence}>
          <option value="off">Off — only when I ask</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </section>

      <section className="settings-section">
        <h2>What leaves your device</h2>
        <p className="section-note">
          Using <strong>{preview?.provider}</strong> as the language model. When a reflection is generated or a
          question is asked, the full text of the entries below — not just metadata — is sent to that provider.
        </p>
        {preview && (
          <dl className="preview-facts">
            <dt>Entries in scope</dt>
            <dd>{preview.entry_count}</dd>
            {preview.date_range && (
              <>
                <dt>Date range</dt>
                <dd>
                  {new Date(preview.date_range.from).toLocaleDateString()} –{' '}
                  {new Date(preview.date_range.to).toLocaleDateString()}
                </dd>
              </>
            )}
          </dl>
        )}
        <p className="section-note small">
          Exclude any entry from this scope any time from the Entries page, without deleting it.
        </p>
      </section>

      <section className="settings-section">
        <h2>Your data</h2>
        <p className="section-note">
          Everything you've written, plus every reflection, is yours to take at any time in an open, readable
          format.
        </p>
        <a href={api.exportAll()} download className="export-link">
          Export everything
        </a>
      </section>
    </div>
  );
}
