import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import BrandMark from './BrandMark';
import { photoUrl } from '../names';
import { useAuth } from '../state';
import type { MatchSummary } from '../types';

const LINKS = [
  { to: '/discover', label: 'Discover' },
  { to: '/admirers', label: 'Likes' },
  { to: '/matches', label: 'Matches' },
  { to: '/free-time', label: 'Timetable' },
  { to: '/profile', label: 'Profile' },
];

export default function NavBar() {
  const { profile, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  const [admirers, setAdmirers] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        api<{ matches: MatchSummary[] }>('/api/matches'),
        api<{ count: number }>('/api/admirers'),
      ])
        .then(([inbox, crush]) => {
          if (!active) return;
          setUnread(inbox.matches.reduce((sum, m) => sum + m.unread, 0));
          setAdmirers(crush.count);
        })
        .catch(() => undefined);

    load();
    const timer = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="site-header">
      <NavLink to="/discover" className="brand">
        <BrandMark />
        <span>
          UIT Match
          <small>University of Information Technology</small>
        </span>
      </NavLink>

      <nav className="site-nav">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {link.label}
            {link.to === '/matches' && unread > 0 && <span className="nav-badge">{unread}</span>}
            {link.to === '/admirers' && admirers > 0 && <span className="nav-badge">{admirers}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="site-user">
        <img className="avatar sm" src={photoUrl(profile?.photos, profile?.displayName)} alt="" />
        <span>{profile?.displayName}</span>
        <button type="button" className="link-btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
