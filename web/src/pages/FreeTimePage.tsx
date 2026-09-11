import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import AvailabilityGrid, { cellId } from '../components/AvailabilityGrid';
import StageLoader from '../components/StageLoader';
import { useAuth } from '../state';
import type { AvailabilityState, BudgetKey, SlotKey, VenueKey } from '../types';

export default function FreeTimePage() {
  const { meta, refreshProfile } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [budget, setBudget] = useState<BudgetKey>('low');
  const [venue, setVenue] = useState<VenueKey>('either');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const saveTimer = useRef<number | null>(null);
  const loaded = useRef(false);
  // Applying the server's own state should not immediately write it back.
  const skipNextSave = useRef(false);

  useEffect(() => {
    api<AvailabilityState>('/api/profile/availability')
      .then((data) => {
        skipNextSave.current = true;
        setEnabled(data.enabled);
        setCells(new Set(data.cells.map((c) => cellId(c.day, c.slot))));
        setBudget(data.budget);
        setVenue(data.venuePreference);
      })
      .finally(() => {
        setLoading(false);
        loaded.current = true;
      });
  }, []);

  // Debounced auto-save: painting the grid should not fire a request per cell.
  useEffect(() => {
    if (!loaded.current) return undefined;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return undefined;
    }
    setStatus('Saving…');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      try {
        await api<AvailabilityState>('/api/profile/availability', {
          method: 'PUT',
          body: {
            enabled,
            budget,
            venuePreference: venue,
            cells: [...cells].map((id) => {
              const [day, slot] = id.split(':');
              return { day: Number(day), slot: slot as SlotKey };
            }),
          },
        });
        await refreshProfile();
        setStatus('Saved');
      } catch {
        setStatus('Could not save. Check your connection.');
      }
    }, 600);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [cells, enabled, budget, venue, refreshProfile]);

  if (!meta || loading) return <StageLoader label="Loading timetable…" />;

  function setAll(predicate: (day: number, slot: SlotKey) => boolean) {
    const next = new Set<string>();
    for (const day of meta!.days) {
      for (const slot of meta!.slots) {
        if (predicate(day.index, slot.key)) next.add(cellId(day.index, slot.key));
      }
    }
    setCells(next);
  }

  return (
    <>
      <header className="page-hero">
        <div>
          <p className="eyebrow">Free Time Match</p>
          <h1 className="page-title">Your lecture timetable</h1>
          <p className="page-sub">
            Tick the periods when you have no class. Six one-hour lectures, 10 minutes between each,
            lunch 11:50–12:40. Other students only see how many gaps you share — never this grid.
          </p>
        </div>
      </header>

      <div className="panel">

        <div className="switch-row">
          <div>
            <div className="title">Free Time Match</div>
            <div className="desc">
              {enabled
                ? 'On — other students can see how many free periods you share with them.'
                : 'Off — your availability is hidden and you will not see anyone else’s overlap.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle Free Time Match"
            className={`switch${enabled ? ' on' : ''}`}
            onClick={() => setEnabled((v) => !v)}
          />
        </div>

        <div className="chips" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" onClick={() => setAll((_, slot) => slot === 'lunch')}>All lunch</button>
          <button type="button" className="chip" onClick={() => setAll((_, slot) => slot === 'l1' || slot === 'l2' || slot === 'l3')}>Morning lectures</button>
          <button type="button" className="chip" onClick={() => setAll((_, slot) => slot === 'l4' || slot === 'l5' || slot === 'l6')}>Afternoon lectures</button>
          <button type="button" className="chip" onClick={() => setAll((day) => day >= 5)}>Weekends</button>
          <button type="button" className="chip" onClick={() => setCells(new Set())}>Clear</button>
        </div>

        <AvailabilityGrid meta={meta} selected={cells} onChange={setCells} disabled={!enabled} />

        <div className={`save-state${status === 'Saved' ? ' ok' : ''}`}>
          {status && `${status === 'Saved' ? '✓ ' : ''}${status}`}
          {status === 'Saved' && ` · ${cells.size} free ${cells.size === 1 ? 'period' : 'periods'} a week`}
        </div>

        <p className="section-title">Date preferences</p>
        <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12, lineHeight: 1.55 }}>
          Used to tailor the ideas we suggest after you match.
        </p>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="budget">Usual budget</label>
            <select id="budget" className="select" value={budget} onChange={(e) => setBudget(e.target.value as BudgetKey)}>
              {meta.budgets.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              {meta.budgets.find((b) => b.key === budget)?.note}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="venue">Prefer</label>
            <select id="venue" className="select" value={venue} onChange={(e) => setVenue(e.target.value as VenueKey)}>
              {meta.venues.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <p className="notice">
          <strong>How your timetable stays private.</strong> Nobody can request your availability. Before you match,
          another student sees only a <strong>number</strong> — how many periods you both have free — plus a vague hint
          like “weekday lunch breaks”. After you match, you can both see the periods you have <em>in common</em>, and
          nothing else. Turning this off removes you from the comparison entirely.
        </p>
      </div>
    </>
  );
}
