import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { clamp01, SLIDE_COUNT, slideIndex, slideLocal } from './slides';

const SLIDES: TypeSlideCopy[] = [
  {
    kicker: 'We match in the lecture gaps',
    left: { text: 'Find' },
    right: { text: 'Love', ember: true, italic: true },
    sub: 'Slide up. The heart turns with your hand.',
  },
  {
    kicker: 'New people · same campus',
    left: { text: 'Make', stack: 'new' },
    right: { text: 'friend', ember: true },
    sub: 'Slide up. The hands turn clockwise.',
  },
];

const EntranceScene = lazy(() => import('./EntranceScene'));

function bootProgress() {
  if (typeof window === 'undefined') return 0;
  const raw = new URLSearchParams(window.location.search).get('p');
  const value = raw == null ? 0 : Number(raw);
  return Number.isFinite(value) ? Math.min(SLIDE_COUNT, Math.max(0, value)) : 0;
}

function pinFromQuery() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('p');
}

export default function Entrance({ children }: { children: ReactNode }) {
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(() => bootProgress());
  const progressRef = useRef(progress);
  const dragging = useRef(false);
  const dragOrigin = useRef({ y: 0, p: 0 });
  const completed = useRef(false);
  const pinned = useRef(pinFromQuery());

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    progressRef.current = SLIDE_COUNT;
    setProgress(SLIDE_COUNT);
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 1100);
  }, []);

  const apply = useCallback(
    (next: number) => {
      if (completed.current) return;
      const value = pinned.current
        ? Math.min(SLIDE_COUNT - 0.02, Math.max(0, next))
        : Math.min(SLIDE_COUNT, Math.max(0, next));
      progressRef.current = value;
      setProgress(value);
      if (!pinned.current && value >= SLIDE_COUNT - 0.004) finish();
    },
    [finish],
  );

  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.classList.add('entrance-lock');
    return () => document.documentElement.classList.remove('entrance-lock');
  }, [open]);

  useEffect(() => {
    if (!open || leaving) return undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      apply(progressRef.current + event.deltaY * 0.00105);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        apply(progressRef.current + 0.08);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        apply(progressRef.current - 0.08);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [apply, leaving, open]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    dragging.current = true;
    dragOrigin.current = { y: event.clientY, p: progressRef.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!dragging.current) return;
    const dy = dragOrigin.current.y - event.clientY;
    apply(dragOrigin.current.p + dy / (window.innerHeight * 0.62));
  }

  function onPointerUp() {
    dragging.current = false;
  }

  function onReducedNext() {
    if (progressRef.current < 1) apply(1);
    else finish();
  }

  if (!open) return children;

  const slide = slideIndex(progress);
  const local = slideLocal(progress);
  const fallbackSrc = slide === 0 ? '/entrance/heart.png' : '/entrance/hands-photo.jpg';

  return (
    <>
      <div className="entrance-underlay" aria-hidden={!leaving}>
        {children}
      </div>

      <section
        className={`entrance${leaving ? ' is-leaving' : ''}`}
        aria-label="Entrance. Slide up through the intro to enter UIT Match."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ '--p': String(local), '--spin': String(progress) } as CSSProperties}
      >
        <div className="entrance-grid" aria-hidden="true" />
        <div className="entrance-scan" aria-hidden="true" />
        <div className="entrance-grain" aria-hidden="true" />
        <div className="entrance-corners" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="entrance-halo" aria-hidden="true" />
        <div className="entrance-crosshair" aria-hidden="true" />

        <div className="entrance-scene">
          {reduceMotion.current ? (
            <img className={slide === 0 ? 'entrance-fallback-heart' : 'entrance-creation'} src={fallbackSrc} alt="" />
          ) : (
            <Suspense fallback={null}>
              <EntranceScene progressRef={progressRef} />
            </Suspense>
          )}
        </div>

        <header className="entrance-top">
          <p>UIT Match · 2026</p>
          <p>Campus only</p>
          <p>{String(slide + 1).padStart(2, '0')} / {String(SLIDE_COUNT).padStart(2, '0')}</p>
        </header>

        <p className="entrance-coord">16.84° N · UIT Yangon</p>
        <p className="entrance-serial">UM–INTRO–0{slide + 1}</p>

        {SLIDES.map((copy, index) => (
          <TypeSlide
            key={copy.right.text}
            slide={index}
            progress={progress}
            copy={copy}
            reduceMotion={reduceMotion.current}
          />
        ))}

        <aside className="entrance-notes">
          <p>Built for this campus</p>
          <p>University email only</p>
        </aside>

        <div className="entrance-dots" aria-hidden="true">
          {Array.from({ length: SLIDE_COUNT }, (_, index) => (
            <span key={index} className={index === slide ? 'is-on' : ''} />
          ))}
        </div>

        <div className="entrance-rail" aria-hidden="true">
          <span className="entrance-chevron">⌃</span>
          <div className="entrance-track">
            <span className="entrance-fill" />
            <span className="entrance-thumb" />
          </div>
          <span>Slide up</span>
        </div>

        {reduceMotion.current && (
          <button className="entrance-skip" type="button" onClick={onReducedNext}>
            {slide === 0 ? 'Next' : 'Enter UIT Match'}
          </button>
        )}
      </section>
    </>
  );
}

function TypeSlide({
  slide,
  progress,
  copy,
  reduceMotion,
}: {
  slide: number;
  progress: number;
  copy: TypeSlideCopy;
  reduceMotion: boolean;
}) {
  const local = progress - slide;
  const enter = local >= 0 ? 1 : clamp01((local + 0.34) / 0.34);
  const exit = clamp01((local - 0.72) / 0.26);
  const vis = enter * (1 - exit);
  const y = (1 - enter) * 18 + exit * -26;
  const scale = 0.94 + enter * 0.06 - exit * 0.08;
  const split = (8 + Math.max(local, 0) * 64) * (0.4 + enter * 0.6);
  const tilt = Math.max(local, 0) * -9;
  const kickerVis = clamp01((enter - 0.08) / 0.5) * (1 - exit);
  const subVis = vis * (1 - clamp01((local - 0.56) / 0.2));
  const rule = 0.16 + clamp01(local) * 0.84;

  return (
    <div
      className="entrance-type"
      style={{
        opacity: vis,
        transform: `translate3d(0, ${y}vh, 0) scale(${scale})`,
      }}
    >
      <p
        className="entrance-kicker"
        style={{
          opacity: kickerVis,
          transform: `translate3d(0, ${(1 - kickerVis) * 18}px, 0)`,
        }}
      >
        {copy.kicker}
      </p>
      <h1
        className="entrance-line"
        style={{ '--line-gap': `${16 + Math.max(local, 0) * 14}vw` } as CSSProperties}
      >
        <Word
          text={copy.left.text}
          stack={copy.left.stack}
          ember={copy.left.ember}
          italic={copy.left.italic}
          side={-1}
          enter={enter}
          exit={exit}
          split={split}
          tilt={tilt}
          reduceMotion={reduceMotion}
        />
        <Word
          text={copy.right.text}
          ember={copy.right.ember}
          italic={copy.right.italic}
          side={1}
          enter={enter}
          exit={exit}
          split={split}
          tilt={tilt}
          reduceMotion={reduceMotion}
        />
      </h1>
      <span
        className="entrance-type-rule"
        aria-hidden="true"
        style={{ opacity: vis * 0.85, transform: `scaleX(${rule})` }}
      />
      <p className="entrance-sub">
        {copy.sub.split(' ').map((word, index, words) => {
          const t = words.length <= 1 ? 0 : index / (words.length - 1);
          const show = clamp01((subVis - t * 0.45) / 0.55);
          return (
            <span
              key={`${word}-${index}`}
              className="entrance-sub-word"
              style={{
                opacity: show,
                transform: `translate3d(0, ${(1 - show) * 10}px, 0)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function Word({
  text,
  stack,
  ember = false,
  italic = false,
  side,
  enter,
  exit,
  split,
  tilt,
  reduceMotion,
}: {
  text: string;
  stack?: string;
  ember?: boolean;
  italic?: boolean;
  side: -1 | 1;
  enter: number;
  exit: number;
  split: number;
  tilt: number;
  reduceMotion: boolean;
}) {
  const letters = [...text];
  const stackVis = clamp01((enter - 0.42) / 0.4) * (1 - exit);

  return (
    <span
      className={`entrance-word${ember ? ' is-ember' : ''}${stack ? ' is-stack' : ''}${italic ? ' is-italic' : ''}`}
      style={{
        transform: `translate3d(${side * split}px, 0, 0) rotateY(${tilt}deg)`,
      }}
    >
      <span className="entrance-letters">
        {reduceMotion
          ? text
          : letters.map((char, index) => {
              const t = letters.length <= 1 ? 0 : index / (letters.length - 1);
              const inAmt = clamp01((enter - t * 0.36) / 0.64);
              const outAmt = clamp01((exit - (1 - t) * 0.3) / 0.7);
              const show = inAmt * (1 - outAmt);
              const y = (1 - inAmt) * 52 + outAmt * -62;
              const rot = (1 - show) * side * 9;
              const glow = ember ? 8 + show * 18 : 0;
              const blur = (1 - show) * 7;
              return (
                <span
                  key={`${char}${index}`}
                  className="entrance-letter"
                  style={{
                    opacity: 0.06 + show * 0.94,
                    transform: `translate3d(0, ${y}px, 0) rotateZ(${rot}deg)`,
                    filter: ember
                      ? `blur(${blur}px) drop-shadow(0 0 ${glow}px rgba(255, 42, 8, ${0.18 + show * 0.55}))`
                      : `blur(${blur}px)`,
                  }}
                >
                  {char}
                </span>
              );
            })}
      </span>
      {stack ? (
        <small style={{ opacity: stackVis, transform: `translate3d(${(1 - stackVis) * 12}px, 0, 0)` }}>
          {stack}
        </small>
      ) : null}
    </span>
  );
}

type TypeSlideCopy = {
  kicker: string;
  left: { text: string; stack?: string; ember?: boolean; italic?: boolean };
  right: { text: string; ember?: boolean; italic?: boolean };
  sub: string;
};
