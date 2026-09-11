/** Tinder-style given name: "Zin Mar Oo" -> "Zin". */
export function firstName(name: string) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || name;
}

/** UIT has five years and two semesters each. */
export function academicLabel(year?: number | null, semester?: number | null) {
  if (!year) return '';
  return semester ? `Year ${year} · Sem ${semester}` : `Year ${year}`;
}

export function photoUrl(photos: string[] | undefined, name = '?') {
  if (photos?.[0]) return photos[0];
  const initial = (firstName(name)[0] || '?').toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#F3D6DC"/><text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-size="42" fill="#7A3140" font-family="Georgia, serif">${initial}</text></svg>`,
  )}`;
}
