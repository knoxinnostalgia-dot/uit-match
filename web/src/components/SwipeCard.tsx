import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { academicLabel, firstName } from '../names';
import type { DeckCard } from '../types';

export type SwipeDir = 'left' | 'right' | 'up';

const COMMIT_DISTANCE = 105;
const SUPER_DISTANCE = 130;
const EXIT_MS = 380;
const TAP_SLOP = 12;

interface Props {
  card: DeckCard;
  isTop: boolean;
  depth: number;
  forcedExit: SwipeDir | null;
  onExited: (dir: SwipeDir) => void;
  onPhotoIndex?: (index: number) => void;
}

export default function SwipeCard({ card, isTop, depth, forcedExit, onExited, onPhotoIndex }: Props) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<SwipeDir | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forcedExit && !exit) setExit(forcedExit);
  }, [forcedExit, exit]);

  useEffect(() => {
    if (!exit) return undefined;
    const timer = setTimeout(() => onExited(exit), EXIT_MS);
    return () => clearTimeout(timer);
  }, [exit, onExited]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isTop || exit) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || exit) return;
    setDrag({ x: event.clientX - start.current.x, y: event.clientY - start.current.y });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || exit) return;
    start.current = null;
    setDragging(false);

    const photos = card.photos.length > 0 ? card.photos : [''];
    if (Math.abs(drag.x) < TAP_SLOP && Math.abs(drag.y) < TAP_SLOP && photos.length > 1) {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        const x = event.clientX - rect.left;
        setPhotoIndex((current) => {
          const next =
            x < rect.width / 2
              ? (current - 1 + photos.length) % photos.length
              : (current + 1) % photos.length;
          onPhotoIndex?.(next);
          return next;
        });
      }
      setDrag({ x: 0, y: 0 });
      return;
    }

    if (drag.y < -SUPER_DISTANCE && Math.abs(drag.x) < COMMIT_DISTANCE) setExit('up');
    else if (drag.x > COMMIT_DISTANCE) setExit('right');
    else if (drag.x < -COMMIT_DISTANCE) setExit('left');
    else setDrag({ x: 0, y: 0 });
  }

  const lift = dragging ? 22 : 0;
  const rotateY = drag.x / 16;
  const rotateX = -drag.y / 22;
  const rotateZ = drag.x / 28;

  const transform = exit
    ? `translate3d(${exit === 'right' ? 760 : exit === 'left' ? -760 : 0}px, ${
        exit === 'up' ? -920 : 80
      }px, 80px) rotateY(${exit === 'right' ? 28 : exit === 'left' ? -28 : 0}deg) rotateZ(${
        exit === 'right' ? 18 : exit === 'left' ? -18 : 0
      }deg)`
    : `translate3d(${drag.x}px, ${drag.y - lift - depth * 10}px, ${lift + depth * -40}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${1 - depth * 0.04})`;

  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const photos = card.photos.length > 0 ? card.photos : [];
  const photo = photos[photoIndex] ?? photos[0];

  return (
    <div
      ref={cardRef}
      className={`card${isTop ? ' is-top' : ''}`}
      style={{
        transform,
        transition: dragging ? 'none' : `transform ${exit ? EXIT_MS : 280}ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.25s`,
        opacity: exit ? 0 : 1,
        zIndex: 10 - depth,
        pointerEvents: isTop ? 'auto' : 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="card-photo"
        style={{
          backgroundImage: photo
            ? `url(${photo})`
            : 'linear-gradient(160deg, #3a1014, #12080a)',
        }}
      />
      <div className="card-shade" />

      {photos.length > 1 && (
        <div className="photo-pips" aria-hidden="true">
          {photos.map((src, index) => (
            <span key={src} className={index === photoIndex ? 'on' : ''} />
          ))}
        </div>
      )}

      <div className="stamp like" style={{ opacity: clamp(drag.x / 100) }}>LIKE</div>
      <div className="stamp nope" style={{ opacity: clamp(-drag.x / 100) }}>PASS</div>
      <div className="stamp super" style={{ opacity: clamp(-drag.y / 120) }}>SUPER</div>

      <div className="card-body">
        <div className="card-heading">
          <div>
            <p className="verified-badge">UIT student</p>
            <div className="card-name">
              {firstName(card.displayName)}, {card.age}
            </div>
            <div className="card-major">
              {card.major ?? 'University of Information Technology'}
              {card.studyYear ? ` · ${academicLabel(card.studyYear, card.studySemester)}` : ''}
            </div>
          </div>
          <div className={`score${card.compatibility.score >= 75 ? ' high' : ''}`}>
            {card.compatibility.score}%
            <span className="score-label"> compatible</span>
          </div>
        </div>

        {card.freeTime.available && card.freeTime.overlapCount > 0 ? (
          <div className="freetime-line">
            <span>
              <strong>
                {card.freeTime.overlapCount} overlapping free {card.freeTime.overlapCount === 1 ? 'period' : 'periods'}
              </strong>
              {card.freeTime.hint && <span className="hint"> · {card.freeTime.hint}</span>}
            </span>
          </div>
        ) : (
          <div className="freetime-line empty">
            <span>{card.freeTime.available ? 'No free time in common this week' : 'Free Time Match is off'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
