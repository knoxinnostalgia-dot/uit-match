import { useNavigate } from 'react-router-dom';
import { firstName, photoUrl } from '../names';
import type { FreeTimeInfo, Profile, Spark } from '../types';

interface Props {
  matchId: number;
  them: Profile;
  myPhoto?: string;
  freeTime: FreeTimeInfo;
  sparks?: Spark[];
  onClose: () => void;
}

export default function MatchModal({ matchId, them, myPhoto, freeTime, sparks = [], onClose }: Props) {
  const navigate = useNavigate();
  const given = firstName(them.displayName);
  const hasOverlap = freeTime.available && freeTime.overlapCount > 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">It’s a match</p>
        <p className="match-title">You and {given} liked each other</p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          You both liked each other. Take it from here.
        </p>

        {sparks.length > 0 && (
          <div className="spark-quote">
            {sparks.map((spark) => (
              <p key={spark.note}>“{spark.note}”</p>
            ))}
          </div>
        )}

        <div className="match-avatars">
          <img src={myPhoto || photoUrl(undefined, 'You')} alt="You" />
          <img src={photoUrl(them.photos, them.displayName)} alt={them.displayName} />
        </div>

        {hasOverlap ? (
          <>
            <div className="freetime-line" style={{ justifyContent: 'center' }}>
              <span>
                <strong>
                  {freeTime.overlapCount} shared free {freeTime.overlapCount === 1 ? 'period' : 'periods'} this week
                </strong>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 12 }}>
              {freeTime.slots.length > 0 && (
                <>
                  {freeTime.slots
                    .slice(0, 3)
                    .map((s) => `${s.dayShort} ${s.slotLabel}`)
                    .join(', ')}
                  {freeTime.slots.length > 3 && ` +${freeTime.slots.length - 3} more`}
                  .
                </>
              )}
            </p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            {freeTime.available
              ? 'No free periods line up this week, but you can still work something out in chat.'
              : 'Turn on Free Time Match to see when you are both free.'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <button className="btn" type="button" onClick={() => navigate(`/matches/${matchId}?tab=profile`)}>
            See full profile
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate(`/matches/${matchId}?plan=1`)}>
            {hasOverlap ? 'Plan a date' : 'Send a message'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Keep looking
          </button>
        </div>
      </div>
    </div>
  );
}
