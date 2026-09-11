import { useState, type FormEvent } from 'react';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../state';

const CAMPUS =
  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1800&q=80';
const POLAROIDS = [
  'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1529333166437-4c848294cea9?auto=format&fit=crop&w=600&q=80',
];

export default function AuthPage() {
  const { signIn, signUp, meta } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const domain = meta?.allowedEmailDomains[0] ?? 'uit.edu.mm';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-split">
      <section className="auth-visual">
        <img className="auth-hero-photo" src={CAMPUS} alt="" />
        <div className="heart-field" aria-hidden="true">
          <span>♥</span><span>♥</span><span>♥</span><span>♥</span><span>♥</span>
        </div>
        <div className="polaroid-stack" aria-hidden="true">
          {POLAROIDS.map((src) => (
            <div key={src} className="polaroid">
              <img src={src} alt="" />
            </div>
          ))}
        </div>
        <div className="auth-visual-copy">
          <p className="eyebrow">Campus dating · UIT</p>
          <h1>Find someone who makes the lecture gaps worth it.</h1>
          <p>
            UIT Match is for real students, real crushes, and real free periods.
            Sign in with your university email — nobody else gets in.
          </p>
          <ul className="trust-pills">
            <li>University email only</li>
            <li>No fake profiles</li>
            <li>Your timetable stays private</li>
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand">
            <BrandMark />
            UIT Match
          </div>

          <h2>{mode === 'in' ? 'Welcome back' : 'Start something'}</h2>
          <p className="page-sub">Use your @{domain} address. Everyone here is from campus.</p>

          <div className="seg" style={{ marginTop: 20 }}>
            <button type="button" className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>
              Sign in
            </button>
            <button type="button" className={mode === 'up' ? 'active' : ''} onClick={() => setMode('up')}>
              Create account
            </button>
          </div>

          <form onSubmit={submit}>
            {error && <div className="error-box">{error}</div>}

            <div className="field">
              <label className="label" htmlFor="email">University email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder={`yourname@${domain}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="legal-note">
            By continuing you agree to treat other students with respect. Fake profiles,
            harassment, and off-campus accounts are removed. Your lecture grid is never
            shown in full — only overlapping free periods after a match.
          </p>
        </div>
      </section>
    </div>
  );
}
