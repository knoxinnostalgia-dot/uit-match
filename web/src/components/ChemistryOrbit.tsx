interface Props {
  interests: number;
  academic: number;
  age: number;
  freeTime: number | null;
}

function Arc({
  index,
  value,
  color,
}: {
  index: number;
  value: number;
  color: string;
}) {
  const radius = 42 - index * 8;
  const length = 2 * Math.PI * radius;
  const dash = Math.max(0.08, value / 100) * length;
  return (
    <circle
      cx="56"
      cy="56"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      strokeDasharray={`${dash} ${length}`}
      transform="rotate(-90 56 56)"
    />
  );
}

export default function ChemistryOrbit({ interests, academic, age, freeTime }: Props) {
  const time = freeTime ?? 0;
  return (
    <div className="orbit-wrap">
      <svg className="orbit" viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r="42" className="orbit-track" />
        <circle cx="56" cy="56" r="34" className="orbit-track" />
        <circle cx="56" cy="56" r="26" className="orbit-track" />
        <circle cx="56" cy="56" r="18" className="orbit-track" />
        <Arc index={0} value={interests} color="#c45c6a" />
        <Arc index={1} value={academic} color="#d4896f" />
        <Arc index={2} value={age} color="#e0a3ad" />
        <Arc index={3} value={time} color="#2f6b4f" />
        <circle cx="56" cy="56" r="7" fill="#c45c6a" />
      </svg>
      <ul className="orbit-legend">
        <li><span style={{ background: '#c45c6a' }} /> Interests {interests}%</li>
        <li><span style={{ background: '#d4896f' }} /> Academic {academic}%</li>
        <li><span style={{ background: '#e0a3ad' }} /> Age {age}%</li>
        <li><span style={{ background: '#2f6b4f' }} /> Free time {freeTime === null ? '—' : `${freeTime}%`}</li>
      </ul>
    </div>
  );
}
