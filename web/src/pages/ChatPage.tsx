import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import PlanDatePanel from '../components/PlanDatePanel';
import SafetySheet from '../components/SafetySheet';
import StageLoader from '../components/StageLoader';
import { academicLabel, firstName, photoUrl } from '../names';
import { useAuth } from '../state';
import type { DatePlan, MatchDetail, Message } from '../types';

export default function ChatPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const navigate = useNavigate();
  const { meta } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showPlan, setShowPlan] = useState(searchParams.get('plan') === '1');
  const [showPlans, setShowPlans] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [tab, setTab] = useState<'chat' | 'profile'>(
    searchParams.get('tab') === 'profile' ? 'profile' : 'chat',
  );

  const threadRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const loadDetail = useCallback(() => {
    api<{ match: MatchDetail }>(`/api/matches/${matchId}`)
      .then((data) => setDetail(data.match))
      .catch(() => navigate('/matches'));
  }, [matchId, navigate]);

  useEffect(loadDetail, [loadDetail]);

  const pullMessages = useCallback(
    (active = { current: true }) =>
      api<{ messages: Message[] }>(`/api/matches/${matchId}/messages?after=${lastId.current}`)
        .then((data) => {
          if (!active.current || data.messages.length === 0) return;
          lastId.current = data.messages[data.messages.length - 1].id;
          setMessages((current) => [...current, ...data.messages]);
        })
        .catch(() => undefined),
    [matchId],
  );

  // Reset the cursor when switching conversations, otherwise a high lastId
  // from the previous match would skip this thread's messages.
  useEffect(() => {
    const active = { current: true };
    lastId.current = 0;
    setMessages([]);
    pullMessages(active);
    const timer = setInterval(() => pullMessages(active), 2500);
    return () => {
      active.current = false;
      clearInterval(timer);
    };
  }, [matchId, pullMessages]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setDraft('');
    try {
      const data = await api<{ message: Message }>(`/api/matches/${matchId}/messages`, {
        method: 'POST',
        body: { body },
      });
      lastId.current = data.message.id;
      setMessages((current) => [...current, data.message]);
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  async function respond(plan: DatePlan, status: 'accepted' | 'declined') {
    await api(`/api/plans/${plan.id}/respond`, { method: 'POST', body: { status } });
    loadDetail();
    pullMessages();
  }

  function closePlanSheet() {
    setShowPlan(false);
    if (!searchParams.get('plan')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('plan');
    setSearchParams(next, { replace: true });
  }

  if (!detail) return <StageLoader label="Opening chat…" />;

  const given = firstName(detail.profile.displayName);
  const overlap = detail.freeTime.available ? detail.freeTime.overlapCount : 0;
  const activePlans = detail.plans.filter((p) => p.status !== 'declined');

  return (
    <>
    <div className="chat-frame">
      <div className="chat-head">
        <button className="back" type="button" onClick={() => navigate('/matches')} aria-label="Back">←</button>
        <img className="avatar sm" src={photoUrl(detail.profile.photos, detail.profile.displayName)} alt={detail.profile.displayName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.profile.displayName}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
            {detail.compatibility.score}% compatible
            {overlap > 0 && ` · ${overlap} shared free ${overlap === 1 ? 'period' : 'periods'}`}
          </div>
        </div>
        <button className="icon-btn" type="button" onClick={() => setShowSafety(true)} aria-label="More">⋯</button>
        <button className="btn btn-sm" type="button" onClick={() => setShowPlan(true)}>Plan a date</button>
      </div>
      <div className="chat-tabbar">
        <div className="chat-tabs">
          <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            Chat
          </button>
          <button type="button" className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
            Profile
          </button>
        </div>
      </div>

      <div className="chat-body">
        {tab === 'profile' ? (
          <div className="match-profile">
            <div className="match-photos">
              {(detail.profile.photos.length ? detail.profile.photos : [photoUrl(undefined, detail.profile.displayName)]).map((src) => (
                <img key={src} src={src} alt="" />
              ))}
            </div>
            <h2 className="page-title" style={{ marginTop: 8 }}>
              {detail.profile.displayName}, {detail.profile.age}
            </h2>
            <p className="page-sub">
              {detail.profile.major ?? 'UIT'}
              {detail.profile.studyYear
                ? ` · ${academicLabel(detail.profile.studyYear, detail.profile.studySemester)}`
                : ''}
            </p>
            <div className={`score-banner${detail.compatibility.score >= 75 ? ' high' : ''}`}>
              <strong>{detail.compatibility.score}%</strong>
              <span>compatible</span>
            </div>
            {detail.profile.bio && <p className="panel-bio">{detail.profile.bio}</p>}
            {detail.profile.interests.length > 0 && (
              <>
                <p className="section-title">Interests</p>
                <div className="chips">
                  {detail.profile.interests.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
              </>
            )}
            {detail.compatibility.chips.length > 0 && (
              <>
                <p className="section-title">In common</p>
                <div className="chips">
                  {detail.compatibility.chips.map((chip) => (
                    <span key={chip} className="chip tiny">{chip}</span>
                  ))}
                </div>
              </>
            )}
            {overlap > 0 && (
              <>
                <p className="section-title">Shared free periods</p>
                <div className="chips">
                  {detail.freeTime.slots.map((slot) => (
                    <span key={`${slot.day}:${slot.slot}`} className="chip tiny">
                      {slot.dayShort} · {slot.slotLabel}
                      {slot.slotRange ? ` ${slot.slotRange}` : ''}
                    </span>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                  Only overlapping gaps are shown. Neither of you can see the other's full timetable.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
        {detail.rightNow && (
          <div className="serendipity in-chat">
            <span className="pulse-dot" />
            <strong>You're both free right now</strong>
            <span>
              {detail.rightNow.slotLabel}
              {detail.rightNow.slotRange ? ` ${detail.rightNow.slotRange}` : ''}
              {detail.rightNow.endsInMinutes > 0 ? ` · ${detail.rightNow.endsInMinutes} min left` : ''}
            </span>
          </div>
        )}

        {overlap > 0 && (
          <button
            type="button"
            className="freetime-line"
            style={{ width: '100%', textAlign: 'left', marginTop: 12, cursor: 'pointer' }}
            onClick={() => setShowPlans((v) => !v)}
          >
            <span>
              <strong>You and {given} have overlapping free time.</strong>
              <span className="hint"> {showPlans ? 'Hide' : 'View'} shared times</span>
            </span>
          </button>
        )}

        {showPlans && (
          <div style={{ marginTop: 10 }}>
            <div className="chips">
              {detail.freeTime.slots.map((slot) => (
                <span key={`${slot.day}:${slot.slot}`} className="chip tiny">
                  {slot.dayShort} · {slot.slotLabel}
                </span>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
              Only the times you <em>both</em> marked free are shown. Neither of you can see the other's full week.
            </p>
          </div>
        )}

        {activePlans.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p className="section-title" style={{ marginTop: 0 }}>Date plans</p>
            {activePlans.map((plan) => (
              <div key={plan.id} className={`plan ${plan.status}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14.5 }}>
                    {meta?.activities.find((a) => a.key === plan.activity)?.emoji} {plan.title}
                  </strong>
                  <span className="plan-status">{plan.status}</span>
                </div>
                {plan.day !== null && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>
                    🕐 {meta?.days.find((d) => d.index === plan.day)?.label}{' '}
                    {meta?.slots.find((s) => s.key === plan.slot)?.short}{' '}
                    {meta?.slots.find((s) => s.key === plan.slot)?.range}
                  </div>
                )}
                {plan.status === 'proposed' && !plan.proposedByMe && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                    <button className="btn btn-sm" type="button" onClick={() => respond(plan, 'accepted')}>Accept</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => respond(plan, 'declined')}>Can't make it</button>
                  </div>
                )}
                {plan.status === 'proposed' && plan.proposedByMe && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Waiting for {given} to reply…</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="thread" ref={threadRef}>
          <div className="chat-photo-card">
            <img src={photoUrl(detail.profile.photos, detail.profile.displayName)} alt="" />
            <p>You matched with {given}. Treat this conversation the way you would on campus.</p>
          </div>
          {messages.length === 0 && (
            <p className="notice center">Say something when you're ready.</p>
          )}
          {messages.map((message) => {
            const isSystem = /^(📅|✅|❌)/.test(message.body);
            return (
              <div key={message.id} className={`bubble ${isSystem ? 'system' : message.mine ? 'mine' : 'them'}`}>
                {message.body}
              </div>
            );
          })}
        </div>

        <form className="composer" onSubmit={send}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${given}…`}
            maxLength={2000}
          />
          <button className={`send${sending ? ' is-busy' : ''}`} type="submit" disabled={sending || !draft.trim()} aria-label="Send">➤</button>
        </form>
          </>
        )}
      </div>
    </div>

      {showPlan && (
        <PlanDatePanel
          matchId={matchId}
          them={detail.profile}
          freeTime={detail.freeTime}
          onClose={closePlanSheet}
          onProposed={() => {
            loadDetail();
            pullMessages();
          }}
        />
      )}

      {showSafety && (
        <SafetySheet
          matchId={matchId}
          userId={detail.profile.userId}
          name={given}
          onClose={() => setShowSafety(false)}
          onDone={() => navigate('/matches')}
        />
      )}
    </>
  );
}
