import { useEffect, useState } from 'react';
import { api } from '../api';
import { firstName } from '../names';
import { useAuth } from '../state';
import type { BudgetKey, DateIdea, DatePlan, FreeTimeInfo, Profile, VenueKey } from '../types';

interface Props {
  matchId: number;
  them: Profile;
  freeTime: FreeTimeInfo;
  onClose: () => void;
  onProposed: (plan: DatePlan) => void;
}

export default function PlanDatePanel({ matchId, them, freeTime, onClose, onProposed }: Props) {
  const { meta, profile } = useAuth();
  const [activity, setActivity] = useState('coffee');
  const [budget, setBudget] = useState<BudgetKey>(profile?.budget ?? 'low');
  const [venue, setVenue] = useState<VenueKey>(profile?.venuePreference ?? 'either');
  const [ideas, setIdeas] = useState<DateIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState<string | null>(null);

  const given = firstName(them.displayName);
  const hasOverlap = freeTime.available && freeTime.overlapCount > 0;

  useEffect(() => {
    setLoading(true);
    api<{ ideas: DateIdea[] }>(
      `/api/matches/${matchId}/date-ideas?activity=${activity}&budget=${budget}&venue=${venue}`,
    )
      .then((data) => setIdeas(data.ideas))
      .catch(() => setIdeas([]))
      .finally(() => setLoading(false));
  }, [matchId, activity, budget, venue]);

  async function propose(idea: DateIdea) {
    setProposing(idea.title);
    try {
      const data = await api<{ plan: DatePlan }>(`/api/matches/${matchId}/plans`, {
        method: 'POST',
        body: {
          activity: idea.activity,
          title: idea.title,
          description: idea.description,
          day: idea.suggestedDay,
          slot: idea.suggestedSlot,
          budget: idea.budget,
          venue: idea.venue,
        },
      });
      onProposed(data.plan);
      onClose();
    } finally {
      setProposing(null);
    }
  }

  if (!meta) return null;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grip" />

        <h2 className="page-title" style={{ marginTop: 0 }}>Plan a date</h2>

        {hasOverlap ? (
          <>
            <div className="freetime-line" style={{ marginBottom: 10 }}>
              🕐
              <span>
                <strong>You and {given} have overlapping free time.</strong>
              </span>
            </div>
            <div className="chips" style={{ marginBottom: 4 }}>
              {freeTime.slots.map((slot) => (
                <span key={`${slot.day}:${slot.slot}`} className="chip tiny">
                  {slot.dayShort} · {slot.slotLabel}
                  {slot.slotRange ? ` ${slot.slotRange}` : ''}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="page-sub">
            {freeTime.available
              ? `Nothing lines up this week, but you can still suggest something and agree a time in chat.`
              : `Free Time Match is off, so there is no shared availability to work from.`}
          </p>
        )}

        <p className="section-title">What do you want to do?</p>
        <div className="activity-grid">
          {meta.activities.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`activity${activity === option.key ? ' selected' : ''}`}
              onClick={() => setActivity(option.key)}
            >
              <span className="emoji">{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <div className="field">
            <label className="label" htmlFor="budget">Budget</label>
            <select id="budget" className="select" value={budget} onChange={(e) => setBudget(e.target.value as BudgetKey)}>
              {meta.budgets.map((b) => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              {meta.budgets.find((b) => b.key === budget)?.note}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="venue">Where</label>
            <select id="venue" className="select" value={venue} onChange={(e) => setVenue(e.target.value as VenueKey)}>
              {meta.venues.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="section-title">Ideas for the two of you</p>
        {loading ? (
          <div className="spinner" />
        ) : ideas.length === 0 ? (
          <p className="notice">Nothing fits that budget. Try raising it or picking another activity.</p>
        ) : (
          ideas.map((idea) => (
            <div key={idea.title} className="idea">
              <div className="idea-top">
                <span className="idea-title">{idea.title}</span>
                <button
                  className="btn btn-sm"
                  type="button"
                  disabled={proposing !== null}
                  onClick={() => propose(idea)}
                >
                  {proposing === idea.title ? '…' : 'Suggest'}
                </button>
              </div>
              <div className="idea-desc">{idea.description}</div>
              <div className="idea-why">{idea.why}</div>
              <div className="idea-meta">
                {idea.suggestedWhen && <span className="chip tiny">🕐 {idea.suggestedWhen}</span>}
                <span className="chip tiny">
                  {idea.venue === 'campus' ? '🏫 On campus' : '📍 Near campus'}
                </span>
                <span className="chip tiny">
                  💰 {meta.budgets.find((b) => b.key === idea.budget)?.label ?? idea.budget}
                </span>
              </div>
            </div>
          ))
        )}

        <button className="btn btn-ghost" type="button" onClick={onClose} style={{ marginTop: 8 }}>
          Close
        </button>
      </div>
    </>
  );
}
