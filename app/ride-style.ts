import type { Movement } from '../lib/program';
export const gaitColors = {
  skridt: '#25813b',
  trav: '#2365c7',
  galop: '#c63838',
  neutral: '#62717c',
} as const;
// Travers previously fell through to `undefined`, drawing it identically to an
// ordinary segment. Round caps turn the near-zero dash into a dot.
export function lineDash(movement: Movement = 'normal') {
  if (movement === 'schenkelvigning') return '.65 .4';
  if (movement === 'travers') return '.01 .45';
  return undefined;
}
// Offset only the drawn notation; animation always uses the original centreline.
export function zigzagPath(path: SVGPathElement) {
  const length = path.getTotalLength(),
    n = Math.max(1, Math.ceil(length / 0.4));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const at = (length * i) / n,
      p = path.getPointAtLength(at),
      before = path.getPointAtLength(Math.max(0, at - 0.05)),
      after = path.getPointAtLength(Math.min(length, at + 0.05));
    const dx = after.x - before.x,
      dy = after.y - before.y,
      norm = Math.hypot(dx, dy) || 1,
      offset = i === 0 || i === n ? 0 : i % 2 ? 0.2 : -0.2;
    d += `${i ? ' L' : 'M'}${p.x - (dy / norm) * offset} ${p.y + (dx / norm) * offset}`;
  }
  return d;
}
