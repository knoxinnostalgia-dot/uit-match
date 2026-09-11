/** Heart, handshake, then a third slide once it is specified. */
export const SLIDE_COUNT = 2;

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function slideIndex(progress: number) {
  if (progress >= SLIDE_COUNT) return SLIDE_COUNT - 1;
  return Math.max(0, Math.floor(progress));
}

export function slideLocal(progress: number) {
  if (progress >= SLIDE_COUNT) return 1;
  return progress - slideIndex(progress);
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
