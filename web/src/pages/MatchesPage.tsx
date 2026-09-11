import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { academicLabel, firstName, photoUrl } from '../names';
import type { MatchSummary } from '../types';

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      api<{ matches: MatchSummary[] }>('/api/matches')
        .then((data) => {
          if (active) setMatches(data.matches);
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoading(false);
        });

    load();
    const timer = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const newMatches = matches.filter((match) => !match.lastMessage);
  const yourTurn = matches.filter((match) => match.lastMessage && !match.lastMessage.mine);
  const theirTurn = matches.filter((match) => match.lastMessage?.mine);

  return (
    <>
      <header className="page-hero">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className="page-title">Matches</h1>
          <p className="page-sub">
            People you both liked on Discover. Open chat, or the Profile tab for photos, bio, and shared lecture gaps.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="spinner" />
      ) : matches.length === 0 ? (
        <div className="empty-panel">
          <span className="big">♥</span>
          <strong>No matches yet</strong>
          <p className="muted">When two real students like each other, they show up here.</p>
          <Link to="/discover" className="btn btn-sm" style={{ width: 'auto', textDecoration: 'none' }}>
            Go to Discover
          </Link>
        </div>
      ) : (
        <div className="inbox-layout">
          {newMatches.length > 0 && (
            <section>
              <p className="turn-label">New matches ({newMatches.length})</p>
              <div className="match-grid">
                {newMatches.map((match) => (
                  <Link key={match.id} to={`/matches/${match.id}`} className="match-card">
                    <div
                      className="match-card-photo"
                      style={{
                        backgroundImage: `url(${photoUrl(match.profile.photos, match.profile.displayName)})`,
                      }}
                    />
                    <div className="match-card-body">
                      <div className="match-name">{firstName(match.profile.displayName)}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {match.profile.major}
                        {match.profile.studyYear
                          ? ` · ${academicLabel(match.profile.studyYear, match.profile.studySemester)}`
                          : ''}
                      </div>
                      {match.freeTime.available && match.freeTime.overlapCount > 0 && (
                        <span className="pill">{match.freeTime.overlapCount} shared periods</span>
                      )}
                      <div className="match-preview">Say hello</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {yourTurn.length > 0 && (
            <section>
              <p className="turn-label">Your turn ({yourTurn.length})</p>
              <div className="match-inbox">
                {yourTurn.map((match) => (
                  <MatchRow key={match.id} match={match} />
                ))}
              </div>
            </section>
          )}

          {theirTurn.length > 0 && (
            <section>
              <p className="turn-label">Their turn ({theirTurn.length})</p>
              <div className="match-inbox">
                {theirTurn.map((match) => (
                  <MatchRow key={match.id} match={match} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function MatchRow({ match }: { match: MatchSummary }) {
  return (
    <Link to={`/matches/${match.id}`} className="match-row">
      <img
        className="avatar"
        src={photoUrl(match.profile.photos, match.profile.displayName)}
        alt=""
      />
      <div className="match-info">
        <div className="match-name">
          {firstName(match.profile.displayName)}
          {match.unread > 0 && <span className="count-badge">{match.unread}</span>}
        </div>
        <div className={`match-preview${match.unread > 0 ? ' unread' : ''}`}>
          {match.lastMessage
            ? `${match.lastMessage.mine ? 'You: ' : ''}${match.lastMessage.body}`
            : 'Say hello'}
        </div>
      </div>
      {match.freeTime.available && match.freeTime.overlapCount > 0 && (
        <span className="pill">{match.freeTime.overlapCount} gaps</span>
      )}
    </Link>
  );
}
