import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { firstName } from '../names';
import type { SerendipityMoment } from '../types';

export default function SerendipityBanner() {
  const [moments, setMoments] = useState<SerendipityMoment[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      api<{ moments: SerendipityMoment[] }>('/api/serendipity')
        .then((data) => {
          if (active) setMoments(data.moments);
        })
        .catch(() => undefined);

    load();
    const timer = setInterval(load, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (moments.length === 0) return null;
  const top = moments[0];

  return (
    <Link to={`/matches/${top.matchId}`} className="serendipity">
      <span className="pulse-dot" />
      <strong>You're both free right now</strong>
      <span>
        {firstName(top.name)} · {top.slotLabel}
        {top.slotRange ? ` ${top.slotRange}` : ''}
        {top.endsInMinutes > 0 ? ` · ${top.endsInMinutes} min left` : ''}
        {moments.length > 1 ? ` · +${moments.length - 1}` : ''}
      </span>
    </Link>
  );
}
