import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import './Ask.css';

export default function Ask() {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [past, setPast] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const data = await api.listQueries();
    setPast(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      const result = await api.ask(question);
      setPast(prev => [result, ...prev]);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="page ask">
      <p className="lede">Ask something about your own history. Answers are grounded in what you've actually written.</p>

      <div className="ask-row">
        <input
          type="text"
          placeholder="Have I talked about quitting my job before?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
        />
        <button className="reflect-btn" onClick={handleAsk} disabled={asking || !question.trim()}>
          {asking ? 'Looking…' : 'Ask'}
        </button>
      </div>

      {error && <p className="notice">{error}</p>}

      <ul className="query-list">
        {past.map(q => (
          <li key={q.id} className="query-item">
            <p className="query-question">{q.question}</p>
            <p className="query-answer">{q.answer}</p>
            <div className="reflection-meta">
              <span>{q.cited_entry_ids.length} entries cited</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
