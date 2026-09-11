import { useRef, useState } from 'react';
import { api } from '../api';
import AcademicFields from '../components/AcademicFields';
import AvailabilityGrid from '../components/AvailabilityGrid';
import BrandMark from '../components/BrandMark';
import ProfilePreview, { ageFrom } from '../components/ProfilePreview';
import StageLoader from '../components/StageLoader';
import { useAuth } from '../state';
import type { AvailabilityState, Gender, OwnProfile, Preference, SlotKey } from '../types';

export default function OnboardingPage() {
  const { meta, refreshProfile, signOut, email } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<Gender>('woman');
  const [interestedIn, setInterestedIn] = useState<Preference>('everyone');
  const [major, setMajor] = useState('');
  const [studyYear, setStudyYear] = useState(1);
  const [studySemester, setStudySemester] = useState(1);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; preview: string }[]>([]);

  if (!meta) {
    return (
      <div className="boot">
        <StageLoader label="UIT Match" />
      </div>
    );
  }

  function toggleInterest(tag: string) {
    setInterests((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : current.length >= 10 ? current : [...current, tag],
    );
  }

  async function saveProfile() {
    setError('');
    setBusy(true);
    try {
      await api<{ profile: OwnProfile }>('/api/profile/me', {
        method: 'PUT',
        body: { displayName, birthdate, gender, interestedIn, major: major || null, studyYear, studySemester, bio, interests },
      });
      for (const { file } of pendingPhotos) {
        const form = new FormData();
        form.append('photo', file);
        await api('/api/profile/photos', { method: 'POST', formData: form });
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function finish(withFreeTime: boolean) {
    setBusy(true);
    try {
      if (withFreeTime) {
        await api<AvailabilityState>('/api/profile/availability', {
          method: 'PUT',
          body: {
            enabled: true,
            cells: [...cells].map((id) => {
              const [day, slot] = id.split(':');
              return { day: Number(day), slot: slot as SlotKey };
            }),
          },
        });
      } else {
        await api<AvailabilityState>('/api/profile/availability', { method: 'PUT', body: { enabled: false } });
      }
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="site">
      <header className="site-header">
        <div className="brand">
          <BrandMark />
          UIT Match
        </div>
        <button type="button" className="link-btn" onClick={signOut}>Sign out</button>
      </header>
      <main className={step === 1 ? 'stage' : 'stage stage-narrow'}>
        {step === 1 ? (
          <div className="onboard-split">
          <div className="panel">
            <p className="eyebrow">Step 1 of 2</p>
            <h1 className="page-title">Set up your profile</h1>
            <p className="page-sub">Signed in as {email}. This is what other UIT students will see.</p>

            {error && <div className="error-box">{error}</div>}

            <div className="field">
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What should people call you?" />
            </div>

            <div className="field">
              <span className="label">Photos</span>
              <div className="photo-grid">
                {pendingPhotos.map((item, index) => (
                  <div key={item.preview} className="photo-tile">
                    <img src={item.preview} alt="" />
                    <button
                      className="remove"
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => {
                        URL.revokeObjectURL(item.preview);
                        setPendingPhotos((current) => current.filter((_, i) => i !== index));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {pendingPhotos.length < meta.maxPhotos && (
                  <button className="photo-add" type="button" onClick={() => fileInput.current?.click()}>
                    <span style={{ fontSize: 22 }}>＋</span>
                    Add photo
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && pendingPhotos.length < meta.maxPhotos) {
                    setPendingPhotos((current) => [...current, { file, preview: URL.createObjectURL(file) }]);
                  }
                  e.target.value = '';
                }}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="dob">Date of birth</label>
              <input id="dob" className="input" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </div>

            <div className="row">
              <div className="field">
                <label className="label" htmlFor="gender">I am a</label>
                <select id="gender" className="select" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="woman">Woman</option>
                  <option value="man">Man</option>
                  <option value="nonbinary">Non-binary</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="pref">Show me</label>
                <select id="pref" className="select" value={interestedIn} onChange={(e) => setInterestedIn(e.target.value as Preference)}>
                  <option value="women">Women</option>
                  <option value="men">Men</option>
                  <option value="everyone">Everyone</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="major">Major</label>
              <select id="major" className="select" value={major} onChange={(e) => setMajor(e.target.value)}>
                <option value="">Select…</option>
                {meta.majors.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <AcademicFields
              year={studyYear}
              semester={studySemester}
              onYear={setStudyYear}
              onSemester={setStudySemester}
            />

            <div className="field">
              <label className="label" htmlFor="bio">About you</label>
              <textarea id="bio" className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A couple of honest sentences beats a clever one-liner." maxLength={500} />
            </div>

            <div className="field">
              <span className="label">Interests {interests.length > 0 && `(${interests.length}/10)`}</span>
              <div className="chips">
                {meta.interests.map((tag) => (
                  <button key={tag} type="button" className={`chip${interests.includes(tag) ? ' selected' : ''}`} onClick={() => toggleInterest(tag)}>
                    {meta.interestEmoji[tag] ?? '✨'} {tag}
                  </button>
                ))}
              </div>
            </div>

            <button className={`btn${busy ? ' is-busy' : ''}`} type="button" disabled={busy || !displayName || !birthdate} onClick={saveProfile}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
          <aside className="live-preview">
            <p className="eyebrow">Live preview</p>
            <ProfilePreview
              name={displayName}
              age={ageFrom(birthdate)}
              photo={pendingPhotos[0]?.preview}
              major={major}
              year={studyYear}
              semester={studySemester}
              bio={bio}
              interests={interests}
            />
          </aside>
          </div>
        ) : (
          <>
            <p className="eyebrow">Step 2 of 2</p>
            <h1 className="page-title">When are you free?</h1>
            <p className="page-sub">
              Tick the UIT lecture periods when you have no class. Six one-hour lectures, 10 minutes
              between each, lunch 11:50–12:40. Other students only see how many periods you share — never this grid.
            </p>

            {error && <div className="error-box">{error}</div>}

            <AvailabilityGrid meta={meta} selected={cells} onChange={setCells} />

            <p className="notice" style={{ marginTop: 14 }}>
              Other students only ever see a <strong>count</strong> of the periods you both have free. Your grid stays
              private, even after you match.
            </p>

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className={`btn${busy ? ' is-busy' : ''}`} type="button" disabled={busy || cells.size === 0} onClick={() => finish(true)}>
                {busy ? 'Saving…' : `Save ${cells.size} free ${cells.size === 1 ? 'period' : 'periods'}`}
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => finish(false)}>
                Skip for now
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
