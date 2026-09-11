import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Meta, SlotKey } from '../types';

export const cellId = (day: number, slot: SlotKey) => `${day}:${slot}`;

interface Props {
  meta: Meta;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

/**
 * UIT lecture timetable. Periods are rows, days are columns — the same layout
 * as a printed campus timetable. Tap a cell to toggle it, or press and drag
 * to paint a run of free periods.
 */
export default function AvailabilityGrid({ meta, selected, onChange, disabled }: Props) {
  const painting = useRef<{ mode: 'add' | 'remove'; touched: Set<string> } | null>(null);
  const latest = useRef(selected);
  latest.current = selected;

  useEffect(() => {
    const stop = () => {
      painting.current = null;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  function apply(id: string, mode: 'add' | 'remove') {
    const next = new Set(latest.current);
    if (mode === 'add') next.add(id);
    else next.delete(id);
    latest.current = next;
    onChange(next);
  }

  function startPaint(id: string) {
    if (disabled) return;
    const mode: 'add' | 'remove' = selected.has(id) ? 'remove' : 'add';
    painting.current = { mode, touched: new Set([id]) };
    apply(id, mode);
  }

  function onPointerMove(event: ReactPointerEvent) {
    const paint = painting.current;
    if (!paint || disabled) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const id = (element as HTMLElement | null)?.dataset?.cell;
    if (!id || paint.touched.has(id)) return;
    paint.touched.add(id);
    apply(id, paint.mode);
  }

  return (
    <div className="grid-wrap">
      <div
        className="tt"
        style={{ gridTemplateColumns: `76px repeat(${meta.days.length}, 1fr)` }}
        onPointerMove={onPointerMove}
      >
        <div />
        {meta.days.map((day) => (
          <div key={day.key} className="tt-head">
            {day.short}
          </div>
        ))}

        {meta.slots.map((slot) => (
          <Row key={slot.key}>
            <div className={`tt-period${slot.key === 'lunch' ? ' lunch' : ''}`}>
              <strong>{slot.short}</strong>
              <span>{slot.range}</span>
            </div>
            {meta.days.map((day) => {
              const id = cellId(day.index, slot.key);
              const on = selected.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-cell={id}
                  disabled={disabled}
                  aria-pressed={on}
                  aria-label={`${day.label} ${slot.label} ${slot.range}${on ? ', free' : ''}`}
                  className={`tt-cell${on ? ' on' : ''}${slot.key === 'lunch' ? ' lunch' : ''}`}
                  onPointerDown={() => startPaint(id)}
                >
                  ✓
                </button>
              );
            })}
          </Row>
        ))}
      </div>
      <p className="tt-note">
        10 minutes between lectures · lunch 11:50–12:40 · Lecture 6 ends at 16:00
      </p>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
