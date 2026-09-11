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
        <Arc index={0} value={interests} color="#ff4a12" />
        <Arc index={1} value={academic} color="#ff8a48" />
        <Arc index={2} value={age} color="#ffd6a3" />
        <Arc index={3} value={time} color="#3d8f68" />
        <circle cx="56" cy="56" r="7" fill="#ff4a12" />
      </svg>
      <ul className="orbit-legend">
        <li><span style={{ background: '#ff4a12' }} /> Interests {interests}%</li>
        <li><span style={{ background: '#ff8a48' }} /> Academic {academic}%</li>
        <li><span style={{ background: '#ffd6a3' }} /> Age {age}%</li>
        <li><span style={{ background: '#3d8f68' }} /> Free time {freeTime === null ? '—' : `${freeTime}%`}</li>
      </ul>
    </div>
  );
}
