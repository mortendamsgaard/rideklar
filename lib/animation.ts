import type { Segment } from './program';
// Move-only paths represent halts and canter departures. Do not depend on the browser's
// getPointAtLength behavior for a path with no drawable segments.
export function stationaryPosition(d: string) {
  const coordinates = d.slice(1).trim().split(/[ ,]+/).map(Number);
  return { x: coordinates[0], y: coordinates[1] };
}
export function timeline(segments: Segment[], lengths: number[]) {
  const speed = { skridt: 2, trav: 4, galop: 5, neutral: 1 };
  const durations = segments.map(
    (s, i) => s.seconds ?? Math.max(0.7, lengths[i] / speed[s.gait]),
  );
  const total = durations.reduce((a, b) => a + b, 0);
  const scale = segments.some((s) => s.seconds !== undefined)
    ? 1
    : Math.max(1, 7 / total);
  return durations.map((t) => t * scale);
}
export function timelinePosition(seconds: number, durations: number[]) {
  let elapsed = 0;
  for (let i = 0; i < durations.length; i++) {
    if (seconds < elapsed + durations[i] || i === durations.length - 1)
      return {
        index: i,
        fraction: Math.max(0, Math.min(1, (seconds - elapsed) / durations[i])),
      };
    elapsed += durations[i];
  }
  return { index: 0, fraction: 0 };
}
