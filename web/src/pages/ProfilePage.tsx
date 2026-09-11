import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import AcademicFields from '../components/AcademicFields';
import ProfilePreview from '../components/ProfilePreview';
import { useAuth } from '../state';
import type { OwnProfile, Preference } from '../types';

export default function ProfilePage() {
  const { profile, meta, refreshProfile, setProfile, email } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState(profile?.bio ?? '');
  const [major, setMajor] = useState(profile?.major ?? '');
  const [studyYear, setStudyYear] = useState(Math.min(profile?.studyYear ?? 1, 5));
  const [studySemester, setStudySemester] = useState(profile?.studySemester ?? 1);
  const [interestedIn, setInterestedIn] = useState<Preference>(profile?.interestedIn ?? 'everyone');
  const [minAge, setMinAge] = useState(profile?.minAge ?? 18);
  const [maxAge, setMaxAge] = useState(profile?.maxAge ?? 30);
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio);
    setMajor(profile.major ?? '');
    setStudyYear(Math.min(profile.studyYear ?? 1, 5));
    setStudySemester(profile.studySemester ?? 1);
    setInterestedIn(profile.interestedIn);
    setMinAge(profile.minAge);
    setMaxAge(profile.maxAge);
    setInterests(profile.interests);
  }, [profile]);

  if (!profile || !meta) return <div className="spinner" />;

  function toggleInterest(tag: string) {
    setInterests((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : current.length >= 10 ? current : [...current, tag],
    );
  }

  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const data = await api<{ profile: OwnProfile }>('/api/profile/me', {
        method: 'PUT',
        body: { bio, major: major || null, studyYear, studySemester, interestedIn, minAge, maxAge, interests },
      });
      setProfile(data.profile);
      setStatus('Saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append('photo', file);
    setBusy(true);
    try {
      await api('/api/profile/photos', { method: 'POST', formData: form });
      await refreshProfile();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(url: string) {
    await api('/api/profile/photos', { method: 'DELETE', body: { url } });
    await refreshProfile();
  }

  return (
    <>
      <header className="page-hero">
        <div>
          <p className="eyebrow">Your profile</p>
          <h1 className="page-title">{profile.displayName}, {profile.age}</h1>
          <p className="page-sub">{email}</p>
        </div>
      </header>

      <div className="profile-layout">
        <section className="panel">
          <p className="section-title" style={{ marginTop: 0 }}>Photos</p>
        <div className="photo-grid">
          {profile.photos.map((url) => (
            <div key={url} className="photo-tile">
              <img src={url} alt="" />
              <button className="remove" type="button" onClick={() => removePhoto(url)} aria-label="Remove photo">✕</button>
            </div>
          ))}
          {profile.photos.length < meta.maxPhotos && (
            <button className="photo-add" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
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
            if (file) uploadPhoto(file);
            e.target.value = '';
          }}
        />

        <p className="section-title">About</p>
        <div className="field">
          <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
        </div>

        <div className="field">
          <label className="label" htmlFor="major">Major</label>
          <select id="major" className="select" value={major} onChange={(e) => setMajor(e.target.value)}>
            <option value="">Not set</option>
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
          <span className="label">Interests ({interests.length}/10)</span>
          <div className="chips">
            {meta.interests.map((tag) => (
              <button key={tag} type="button" className={`chip${interests.includes(tag) ? ' selected' : ''}`} onClick={() => toggleInterest(tag)}>
                {meta.interestEmoji[tag] ?? '✨'} {tag}
              </button>
            ))}
          </div>
        </div>

        <p className="section-title">Who you see</p>
        <div className="field">
          <label className="label" htmlFor="pref">Show me</label>
          <select id="pref" className="select" value={interestedIn} onChange={(e) => setInterestedIn(e.target.value as Preference)}>
            <option value="women">Women</option>
            <option value="men">Men</option>
            <option value="everyone">Everyone</option>
          </select>
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="min">Minimum age</label>
            <input id="min" className="input" type="number" min={18} max={80} value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="max">Maximum age</label>
            <input id="max" className="input" type="number" min={18} max={80} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} />
          </div>
        </div>

        <Link to="/free-time" className="match-row" style={{ marginTop: 6 }}>
          <span style={{ fontSize: 13, width: 40, textAlign: 'center', fontWeight: 800 }}>FT</span>
          <div className="match-info">
            <div className="match-name">Free Time Match</div>
            <div className="match-preview">
              {profile.freeTimeEnabled ? 'On — edit your weekly availability' : 'Off — your timetable is hidden'}
            </div>
          </div>
          <span className="muted">›</span>
        </Link>

        <button className="btn" type="button" onClick={save} disabled={busy} style={{ marginTop: 16 }}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <div className={`save-state${status === 'Saved' ? ' ok' : ''}`}>
          {status && `${status === 'Saved' ? '✓ ' : ''}${status}`}
        </div>
        </section>
        <aside className="live-preview">
          <p className="eyebrow">How others see you</p>
          <ProfilePreview
            name={profile.displayName}
            age={profile.age}
            photo={profile.photos[0]}
            major={major}
            year={studyYear}
            semester={studySemester}
            bio={bio}
            interests={interests}
          />
        </aside>
      </div>
    </>
  );
}
