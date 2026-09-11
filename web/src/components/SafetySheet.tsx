import { useState } from 'react';
import { api } from '../api';

const REASONS = [
  'Inappropriate photos',
  'Harassment or bullying',
  'Fake or misleading profile',
  'Spam',
  'Underage',
  'Something else',
];

interface Props {
  matchId: number;
  userId: number;
  name: string;
  onClose: () => void;
  onDone: () => void;
}

export default function SafetySheet({ matchId, userId, name, onClose, onDone }: Props) {
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function unmatch() {
    setBusy(true);
    try {
      await api(`/api/matches/${matchId}`, { method: 'DELETE' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unmatch.');
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    try {
      await api('/api/blocks', { method: 'POST', body: { userId } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block.');
      setBusy(false);
    }
  }

  async function report() {
    setBusy(true);
    setError('');
    try {
      await api('/api/reports', { method: 'POST', body: { userId, reason, details } });
      await api('/api/blocks', { method: 'POST', body: { userId } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grip" />
        {mode === 'menu' ? (
          <>
            <h2 className="page-title" style={{ marginTop: 0 }}>{name}</h2>
            <p className="page-sub">Unmatching hides the conversation. Blocking also hides them from Discover.</p>
            {error && <div className="error-box">{error}</div>}
            <button className="menu-item" type="button" disabled={busy} onClick={unmatch}>
              Unmatch
            </button>
            <button className="menu-item danger" type="button" disabled={busy} onClick={block}>
              Block
            </button>
            <button className="menu-item danger" type="button" disabled={busy} onClick={() => setMode('report')}>
              Report
            </button>
            <button className="btn btn-ghost" type="button" onClick={onClose} style={{ marginTop: 8 }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <h2 className="page-title" style={{ marginTop: 0 }}>Report {name}</h2>
            <p className="page-sub">We’ll hide them from you after this. They won’t be told who reported them.</p>
            {error && <div className="error-box">{error}</div>}
            <div className="chips" style={{ marginBottom: 14 }}>
              {REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip${reason === item ? ' selected' : ''}`}
                  onClick={() => setReason(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="field">
              <label className="label" htmlFor="report-details">Anything else? (optional)</label>
              <textarea
                id="report-details"
                className="textarea"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
              />
            </div>
            <button className={`btn${busy ? ' is-busy' : ''}`} type="button" disabled={busy} onClick={report}>
              {busy ? 'Sending…' : 'Submit report and block'}
            </button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setMode('menu')} style={{ marginTop: 10 }}>
              Back
            </button>
          </>
        )}
      </div>
    </>
  );
}
