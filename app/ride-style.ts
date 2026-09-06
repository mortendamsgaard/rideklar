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
// Lateral movements do not point where they travel. Every schenkelvigning and
// travers segment in the catalogue runs predominantly along y (the long side),
// so the body snaps to face whichever end of the arena it is heading towards.
export function markerAngle(
  movement: Movement | undefined,
  dx: number,
  dy: number,
  reverse?: boolean,
  x = 0,
  centreX = 0,
) {
  // Schenkelvigning (leg-yield) and sidetraversade (half-pass) both travel a
  // diagonal with the body parallel to the long side.
  if (movement === 'schenkelvigning' || movement === 'travers')
    return dy < 0 ? -90 : 90;
  // Versade sits about 30 degrees to the wall with the HEAD leaning in towards
  // the arena centre. Which rotation that is depends on both the wall the pony
  // is on and the direction of travel, hence the two signs.
  if (movement === 'versade' && dy !== 0)
    return (
      (Math.atan2(dy, dx) * 180) / Math.PI -
      30 * Math.sign(dy) * Math.sign(centreX - x)
    );
  return (Math.atan2(dy, dx) * 180) / Math.PI + (reverse ? 180 : 0);
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
