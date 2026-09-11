import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import StageLoader from '../components/StageLoader';

export default function AdmirersPage() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api<{ count: number }>('/api/admirers')
      .then((data) => setCount(data.count))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <header className="page-hero">
        <div>
          <p className="eyebrow">Likes</p>
          <h1 className="page-title">Someone liked you</h1>
          <p className="page-sub">
            You will not see who it is yet. Keep swiping on Discover. If you like them back, it becomes a match
            and you both unlock the full profile.
          </p>
        </div>
      </header>

      {loading ? (
        <StageLoader label="Checking likes…" />
      ) : count === 0 ? (
        <div className="empty-panel">
          <span className="big">♥</span>
          <strong>No new likes</strong>
          <p className="muted">When someone likes you, a notification lands here — never their name or photo.</p>
          <Link to="/discover" className="btn btn-sm" style={{ width: 'auto', textDecoration: 'none' }}>
            Go to Discover
          </Link>
        </div>
      ) : (
        <div className="like-notice">
          <div className="like-stack" aria-hidden="true">
            <span /><span /><span />
          </div>
          <h2>
            {count === 1 ? '1 person liked you' : `${count} people liked you`}
          </h2>
          <p className="muted">
            Their profile stays hidden until you like them on Discover. No shortcuts, no peeking.
          </p>
          <Link to="/discover" className="btn" style={{ textDecoration: 'none', maxWidth: 280 }}>
            Open Discover
          </Link>
        </div>
      )}
    </>
  );
}
