import { useAuth } from '../state';

interface Props {
  year: number;
  semester: number;
  onYear: (year: number) => void;
  onSemester: (semester: number) => void;
}

export default function AcademicFields({ year, semester, onYear, onSemester }: Props) {
  const { meta } = useAuth();
  const years = meta?.studyYears ?? [1, 2, 3, 4, 5];
  const semesters = meta?.studySemesters ?? [1, 2];

  return (
    <div className="row">
      <div className="field">
        <label className="label" htmlFor="year">Year</label>
        <select
          id="year"
          className="select"
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
        >
          {years.map((item) => (
            <option key={item} value={item}>
              Year {item}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="semester">Semester</label>
        <select
          id="semester"
          className="select"
          value={semester}
          onChange={(e) => onSemester(Number(e.target.value))}
        >
          {semesters.map((item) => (
            <option key={item} value={item}>
              Semester {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
