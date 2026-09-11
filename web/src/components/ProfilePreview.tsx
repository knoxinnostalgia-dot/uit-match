import { academicLabel, photoUrl } from '../names';

interface Props {
  name: string;
  age?: number | null;
  photo?: string;
  major?: string;
  year?: number;
  semester?: number;
  bio?: string;
  interests?: string[];
}

export default function ProfilePreview({
  name,
  age,
  photo,
  major,
  year,
  semester,
  bio,
  interests = [],
}: Props) {
  const label = name.trim() || 'Your name';
  const src = photo || photoUrl(undefined, label);
  const yearLine = academicLabel(year, semester);

  return (
    <article className="preview-card">
      <div className="preview-photo" style={{ backgroundImage: `url(${src})` }} />
      <div className="preview-shade" />
      <div className="preview-body">
        <p className="verified-badge">UIT student</p>
        <h3>
          {label}
          {age ? `, ${age}` : ''}
        </h3>
        <p>
          {major || 'Your major'}
          {yearLine ? ` · ${yearLine}` : ''}
        </p>
        {bio ? <p className="preview-bio">{bio}</p> : <p className="preview-bio muted">A short, honest bio will sit here.</p>}
        {interests.length > 0 && (
          <div className="chips">
            {interests.slice(0, 5).map((tag) => (
              <span key={tag} className="chip tiny">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function ageFrom(birthdate: string) {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

export { ageFrom };
