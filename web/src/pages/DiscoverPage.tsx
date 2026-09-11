import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import ChemistryOrbit from '../components/ChemistryOrbit';
import FateCard from '../components/FateCard';
import MatchModal from '../components/MatchModal';
import SparkSheet from '../components/SparkSheet';
import StageLoader from '../components/StageLoader';
import SwipeCard, { type SwipeDir } from '../components/SwipeCard';
import { academicLabel, firstName } from '../names';
import { useAuth } from '../state';
import type { DeckCard, FreeTimeInfo, Profile, Spark } from '../types';

type SwipeAction = 'like' | 'pass' | 'superlike';

const ACTION_FOR: Record<SwipeDir, SwipeAction> = { right: 'like', left: 'pass', up: 'superlike' };

interface NewMatch {
  id: number;
  profile: Profile;
  freeTime: FreeTimeInfo;
  sparks?: Spark[];
}

export default function DiscoverPage() {
  const { profile } = useAuth();
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [fate, setFate] = useState<DeckCard | null>(null);
  const [weekday, setWeekday] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forcedExit, setForcedExit] = useState<SwipeDir | null>(null);
  const [newMatch, setNewMatch] = useState<NewMatch | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [sparkFor, setSparkFor] = useState<DeckCard | null>(null);
  const [canRewind, setCanRewind] = useState(false);
  const [rewindBusy, setRewindBusy] = useState(false);

  const [likeCount, setLikeCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<{ cards: DeckCard[] }>('/api/discover'),
      api<{ person: DeckCard | null; weekday: string | null }>('/api/fate'),
      api<{ count: number }>('/api/admirers'),
    ])
      .then(([deck, today, likes]) => {
        setFate(today.person);
        setWeekday(today.weekday);
        setLikeCount(likes.count);
        setCards(
          today.person
            ? deck.cards.filter((card) => card.userId !== today.person?.userId)
            : deck.cards,
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load profiles.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const top = cards[0];

  useEffect(() => {
    setPhotoIndex(0);
  }, [top?.userId]);

  const swipe = useCallback(
    (userId: number, action: SwipeAction, extra: { sparkNote?: string; sparkPhoto?: number } = {}) => {
      setCards((current) => current.filter((card) => card.userId !== userId));
      setFate((current) => (current?.userId === userId ? null : current));
      setCanRewind(action === 'pass');

      api<{ match: NewMatch | null }>('/api/swipes', {
        method: 'POST',
        body: { targetId: userId, action, ...extra },
      })
        .then((data) => {
          if (data.match) setNewMatch(data.match);
          return api<{ count: number }>('/api/admirers');
        })
        .then((likes) => {
          if (likes && 'count' in likes) setLikeCount(likes.count);
        })
        .catch(() => undefined);
    },
    [],
  );

  const commit = useCallback(
    (dir: SwipeDir) => {
      const card = cards[0];
      if (!card) return;
      setForcedExit(null);
      swipe(card.userId, ACTION_FOR[dir]);
    },
    [cards, swipe],
  );

  async function rewind() {
    setRewindBusy(true);
    try {
      await api('/api/swipes/rewind', { method: 'POST' });
      setCanRewind(false);
      load();
    } catch {
      setCanRewind(false);
    } finally {
      setRewindBusy(false);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!top || forcedExit || newMatch || sparkFor) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') setForcedExit('right');
      else if (event.key === 'ArrowLeft') setForcedExit('left');
      else if (event.key === 'ArrowUp') setForcedExit('up');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, forcedExit, newMatch, sparkFor]);

  return (
    <>
      <header className="page-hero">
        <div>
          <p className="eyebrow">Discover</p>
          <h1 className="page-title">Someone on campus</h1>
          <p className="page-sub">
            Fate picks one person a day from overlapping lecture gaps. Write a spark on a photo if you want them to
            see why.
          </p>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      {likeCount > 0 && (
        <p className="notice" style={{ marginBottom: 22 }}>
          {likeCount === 1 ? 'Someone liked you.' : `${likeCount} people liked you.`}{' '}
          You will not see who until you like them back on Discover — then it becomes a match.
        </p>
      )}

      {!loading && fate && (
        <FateCard
          person={fate}
          weekday={weekday}
          onLike={() => swipe(fate.userId, 'like')}
          onPass={() => swipe(fate.userId, 'pass')}
          onSpark={() => setSparkFor(fate)}
        />
      )}

      <div className="discover-layout">
        <div className="discover-stage">
          <div className="deck">
            {loading ? (
              <StageLoader label="Finding classmates…" />
            ) : cards.length === 0 ? (
              <div className="empty-deck">
                <span className="big">♥</span>
                <strong>No classmates to show yet</strong>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  UIT Match never fills the deck with fake profiles. Invite a friend to sign up
                  with their university email, then come back here.
                </p>
                <button className="btn btn-ghost btn-sm" type="button" onClick={load}>
                  Refresh
                </button>
              </div>
            ) : (
              cards
                .slice(0, 3)
                .reverse()
                .map((card, reversedIndex, array) => {
                  const depth = array.length - 1 - reversedIndex;
                  return (
                    <SwipeCard
                      key={card.userId}
                      card={card}
                      depth={depth}
                      isTop={depth === 0}
                      forcedExit={depth === 0 ? forcedExit : null}
                      onExited={commit}
                      onPhotoIndex={setPhotoIndex}
                    />
                  );
                })
            )}
          </div>

          {cards.length > 0 && (
            <div className="deck-actions">
              <button
                className="action-btn pass"
                type="button"
                disabled={!top || !!forcedExit}
                onClick={() => setForcedExit('left')}
                aria-label="Pass"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={!top || !!forcedExit}
                onClick={() => top && setSparkFor(top)}
              >
                Spark
              </button>
              <button
                className="action-btn like"
                type="button"
                disabled={!top || !!forcedExit}
                onClick={() => setForcedExit('right')}
                aria-label="Like"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 20.4S3.5 14.7 3.5 8.9A4.4 4.4 0 0 1 12 7.2 4.4 4.4 0 0 1 20.5 8.9C20.5 14.7 12 20.4 12 20.4z" />
                </svg>
              </button>
            </div>
          )}

          {canRewind && (
            <button className="rewind" type="button" disabled={rewindBusy} onClick={rewind}>
              Rewind that pass
            </button>
          )}
        </div>

        <aside className="profile-panel">
          {top ? (
            <>
              <article className="prompt-card">
                <p className="label-quiet">This week</p>
                <h2>
                  {firstName(top.displayName)}, {top.age}
                </h2>
                <p className="panel-major">
                  {top.major ?? 'UIT'}
                  {top.studyYear ? ` · ${academicLabel(top.studyYear, top.studySemester)}` : ''}
                </p>
                <div className={`score-banner${top.compatibility.score >= 75 ? ' high' : ''}`}>
                  <strong>{top.compatibility.score}%</strong>
                  <span>compatible</span>
                </div>
                <ChemistryOrbit
                  interests={top.compatibility.breakdown.interests}
                  academic={top.compatibility.breakdown.academic}
                  age={top.compatibility.breakdown.age}
                  freeTime={top.compatibility.breakdown.freeTime}
                />
              </article>

              <article className="prompt-card">
                <p className="label-quiet">Shared free time</p>
                {top.freeTime.available && top.freeTime.overlapCount > 0 ? (
                  <p>
                    <strong>
                      {top.freeTime.overlapCount} overlapping free{' '}
                      {top.freeTime.overlapCount === 1 ? 'period' : 'periods'}
                    </strong>
                    {top.freeTime.hint ? ` — ${top.freeTime.hint}` : ''}. The full timetable stays private until you both like each other.
                  </p>
                ) : (
                  <p className="muted">
                    {top.freeTime.available
                      ? 'No lecture gaps in common this week.'
                      : 'Free Time Match is off for this student.'}
                  </p>
                )}
              </article>

              {top.bio && (
                <article className="prompt-card">
                  <p className="label-quiet">About</p>
                  <p className="panel-bio">{top.bio}</p>
                </article>
              )}

              {(top.compatibility.chips.length > 0 || top.interests.length > 0) && (
                <article className="prompt-card">
                  <p className="label-quiet">In common</p>
                  <div className="chips">
                    {top.compatibility.chips.map((chip) => (
                      <span key={chip} className="chip tiny">
                        {chip}
                      </span>
                    ))}
                    {top.interests.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              )}
            </>
          ) : (
            <div className="panel-empty">
              <h2>Your campus deck</h2>
              <p className="muted">
                Profiles appear here when other UIT students sign up and finish their timetable. Nobody is generated.
              </p>
            </div>
          )}
        </aside>
      </div>

      {sparkFor && (
        <SparkSheet
          card={sparkFor}
          photoIndex={sparkFor.userId === top?.userId ? photoIndex : 0}
          onClose={() => setSparkFor(null)}
          onSend={(note, index) => {
            const target = sparkFor;
            setSparkFor(null);
            swipe(target.userId, 'like', { sparkNote: note, sparkPhoto: index });
          }}
        />
      )}

      {newMatch && (
        <MatchModal
          matchId={newMatch.id}
          them={newMatch.profile}
          myPhoto={profile?.photos[0]}
          freeTime={newMatch.freeTime}
          sparks={newMatch.sparks}
          onClose={() => setNewMatch(null)}
        />
      )}
    </>
  );
}
