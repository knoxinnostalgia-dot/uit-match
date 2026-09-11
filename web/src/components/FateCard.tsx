import { useRef, useState, type MouseEvent } from 'react';
import { academicLabel, firstName, photoUrl } from '../names';
import type { DeckCard } from '../types';

interface Props {
  person: DeckCard;
  weekday?: string | null;
  onLike: () => void;
  onPass: () => void;
  onSpark: () => void;
}

export default function FateCard({ person, weekday, onLike, onPass, onSpark }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const given = firstName(person.displayName);
  const photo = photoUrl(person.photos, person.displayName);

  function onMove(event: MouseEvent<HTMLElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * 10, y: (x - 0.5) * -14 });
  }

  return (
    <section className="fate-stage">
      <div>
        <p className="eyebrow">Today’s fate</p>
        <h2 className="page-title">Campus picked {given}</h2>
        <p className="page-sub">
          One person a day, locked until midnight Yangon time
          {weekday ? ` · ${weekday}` : ''}. Built from overlapping lecture gaps, not a random shuffle.
        </p>
      </div>

      <article
        ref={cardRef}
        className="fate-card"
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div className="fate-photo" style={{ backgroundImage: `url(${photo})` }} />
        <div className="fate-shade" />
        <div className="fate-copy">
          {person.todayOverlap ? (
            <p className="verified-badge">Free together today · {person.todayOverlap} gaps</p>
          ) : (
            <p className="verified-badge">Today’s pick</p>
          )}
          <h3>
            {given}, {person.age}
          </h3>
          <p>
            {person.major ?? 'UIT'}
            {person.studyYear ? ` · ${academicLabel(person.studyYear, person.studySemester)}` : ''}
            {` · ${person.compatibility.score}%`}
          </p>
          {person.story && <p className="fate-story">{person.story}</p>}
        </div>
      </article>

      <div className="deck-actions">
        <button className="action-btn pass" type="button" onClick={onPass} aria-label="Pass">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button className="btn btn-sm" type="button" onClick={onSpark}>
          Write a spark
        </button>
        <button className="action-btn like" type="button" onClick={onLike} aria-label="Like">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 20.4S3.5 14.7 3.5 8.9A4.4 4.4 0 0 1 12 7.2 4.4 4.4 0 0 1 20.5 8.9C20.5 14.7 12 20.4 12 20.4z" />
          </svg>
        </button>
      </div>
    </section>
  );
}
