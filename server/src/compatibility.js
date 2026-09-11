import { INTEREST_EMOJI, OVERLAP_TARGET } from './config.js';

/**
 * Weights for the compatibility percentage. When two students cannot be
 * compared on free time (either has Free Time Match switched off, or has not
 * filled a timetable in), the free-time weight is redistributed across the
 * other factors instead of scoring them a zero for it.
 */
const WEIGHTS = {
  interests: 0.35,
  academic: 0.15,
  age: 0.1,
  campus: 0.1,
  freeTime: 0.3,
};

const SCORE_FLOOR = 35;
const SCORE_CEILING = 99;

function interestScore(a = [], b = []) {
  if (a.length === 0 || b.length === 0) return { score: 0, shared: [] };
  const setB = new Set(b.map((i) => i.toLowerCase()));
  const shared = a.filter((i) => setB.has(i.toLowerCase()));
  // Overlap coefficient: someone with three interests is not punished for
  // having a short list next to someone who ticked ten.
  return { score: shared.length / Math.min(a.length, b.length), shared };
}

function academicScore(viewer, target) {
  let score = 0;
  const sameMajor = Boolean(viewer.major) && viewer.major === target.major;
  score += sameMajor ? 0.6 : 0.2;

  const yearDiff =
    Number.isInteger(viewer.studyYear) && Number.isInteger(target.studyYear)
      ? Math.abs(viewer.studyYear - target.studyYear)
      : null;
  if (yearDiff === 0) {
    score += 0.3;
    const sameSemester =
      Number.isInteger(viewer.studySemester) &&
      Number.isInteger(target.studySemester) &&
      viewer.studySemester === target.studySemester;
    if (sameSemester) score += 0.15;
    else score += 0.05;
  } else if (yearDiff === 1) score += 0.2;

  return {
    score: Math.min(score, 1),
    sameMajor,
    sameYear: yearDiff === 0,
    sameSemester:
      yearDiff === 0 &&
      Number.isInteger(viewer.studySemester) &&
      Number.isInteger(target.studySemester) &&
      viewer.studySemester === target.studySemester,
  };
}

function ageScore(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0.5;
  return 1 - Math.min(Math.abs(a - b), 6) / 6;
}

function freeTimeScore(overlapCount) {
  return Math.min(overlapCount / OVERLAP_TARGET, 1);
}

/**
 * Blends the pre-existing matching signals with Free Time Match overlap into a
 * single percentage, plus the chips shown under the name on a profile card.
 */
export function computeCompatibility(viewer, target, freeTime) {
  const interests = interestScore(viewer.interests, target.interests);
  const academic = academicScore(viewer, target);
  const age = ageScore(viewer.age, target.age);

  const useFreeTime = Boolean(freeTime?.available);

  const parts = [
    { weight: WEIGHTS.interests, value: interests.score },
    { weight: WEIGHTS.academic, value: academic.score },
    { weight: WEIGHTS.age, value: age },
    { weight: WEIGHTS.campus, value: 1 },
  ];
  if (useFreeTime) {
    parts.push({ weight: WEIGHTS.freeTime, value: freeTimeScore(freeTime.overlapCount) });
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const raw = parts.reduce((sum, p) => sum + p.weight * p.value, 0) / totalWeight;

  const score = Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, Math.round(raw * 100)));

  const chips = [];
  if (academic.sameMajor) chips.push('Same major');
  else if (academic.sameSemester) chips.push(`Both Year ${target.studyYear} Sem ${target.studySemester}`);
  else if (academic.sameYear) chips.push(`Both Year ${target.studyYear}`);
  else chips.push('Same campus');

  for (const interest of interests.shared.slice(0, 3)) {
    chips.push(`${INTEREST_EMOJI[interest] || '✨'} ${interest}`);
  }

  return {
    score,
    chips,
    sharedInterests: interests.shared,
    breakdown: {
      interests: Math.round(interests.score * 100),
      academic: Math.round(academic.score * 100),
      age: Math.round(age * 100),
      freeTime: useFreeTime ? Math.round(freeTimeScore(freeTime.overlapCount) * 100) : null,
    },
  };
}
