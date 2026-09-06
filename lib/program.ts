export type Gait = 'skridt' | 'trav' | 'galop' | 'neutral';
export type Movement = 'normal' | 'schenkelvigning' | 'versade' | 'travers';
export type Segment = {
  d: string;
  gait: Gait;
  movement?: Movement;
  seconds?: number;
  reverse?: boolean;
  hidden?: boolean;
  heading?: number;
};
export type Exercise = {
  id: string;
  number: number;
  sourceNumber: number;
  title: string;
  location: string;
  gaitLabel: string;
  description: string;
  tip: string;
  segments: Segment[];
  size?: { meters: number };
  assessment?: boolean;
  restingPoint?: { x: number; y: number; heading: number };
  assessmentSeconds?: number;
};
export type Program = {
  schemaVersion: 1;
  id: string;
  title: string;
  audience: string;
  description: string;
  source: {
    title: string;
    url: string;
    edition: string;
    documentDate: string;
    checkedOn: string;
    badge: string;
    note: string;
  };
  arena: {
    width: number;
    height: number;
    letters: { label: string; x: number; y: number; interior: boolean }[];
  };
  disclaimer: string;
  referenceDurationSeconds: number;
  maxScore: number;
  exercises: Exercise[];
};
export type Catalog = {
  schemaVersion: 1;
  defaultId: string;
  programs: { id: string; label: string; file: string }[];
};
function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error(`${where}: forventede et objekt`);
  return value as Record<string, unknown>;
}
function str(value: unknown, where: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim())
    throw Error(`${where}: manglende tekst`);
}
function num(
  value: unknown,
  where: string,
  min = -Infinity,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    throw Error(`${where}: ugyldigt tal`);
}
function arr(value: unknown, where: string): asserts value is unknown[] {
  if (!Array.isArray(value) || !value.length)
    throw Error(`${where}: tom eller ugyldig liste`);
}
function optionalBool(value: unknown, where: string) {
  if (value !== undefined && typeof value !== 'boolean')
    throw Error(`${where}: forventede true/false`);
}
// A deliberately bounded SVG dialect keeps externally generated route data predictable.
export function validatePath(value: unknown) {
  str(value, 'segment.d');
  if (
    value.length > 20000 ||
    !/^M\s*[-\d.]/.test(value) ||
    /[^MLQCAZ\d.,\s+eE-]/.test(value)
  )
    throw Error('Ugyldig SVG-ridevej');
  const tokens =
    value.match(/[MLQCAZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const counts: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6, A: 7, Z: 0 };
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (!(cmd in counts))
      throw Error('Ridevejen kræver eksplicitte kommandoer');
    const n = counts[cmd];
    const v = tokens.slice(i, i + n).map(Number);
    if (v.length !== n || v.some((x) => !Number.isFinite(x)))
      throw Error('Ridevejen mangler koordinater');
    if (
      cmd === 'A' &&
      (v[0] <= 0 ||
        v[1] <= 0 ||
        ![0, 1].includes(v[3]) ||
        ![0, 1].includes(v[4]))
    )
      throw Error('Ugyldig cirkelbue');
    i += n;
  }
}
export function parseCatalog(input: unknown): Catalog {
  const c = record(input, 'katalog');
  if (c.schemaVersion !== 1) throw Error('Ukendt katalogversion');
  str(c.defaultId, 'defaultId');
  arr(c.programs, 'programs');
  const ids = new Set();
  for (const x of c.programs) {
    const p = record(x, 'program');
    str(p.id, 'id');
    str(p.label, 'label');
    str(p.file, 'file');
    if (!/^\/programs\/[a-z0-9-]+\.json$/.test(p.file))
      throw Error('Ugyldig lokal programfil');
    if (ids.has(p.id)) throw Error('Gentaget program-id');
    ids.add(p.id);
  }
  if (!ids.has(c.defaultId)) throw Error('Standardprogram findes ikke');
  return input as Catalog;
}
export function parseProgram(input: unknown): Program {
  const p = record(input, 'program');
  if (p.schemaVersion !== 1) throw Error('Ukendt programversion');
  for (const k of ['id', 'title', 'audience', 'description', 'disclaimer'])
    str(p[k], k);
  num(p.referenceDurationSeconds, 'referenceDurationSeconds', 1);
  num(p.maxScore, 'maxScore', 1);
  const source = record(p.source, 'source');
  for (const k of [
    'title',
    'url',
    'edition',
    'documentDate',
    'checkedOn',
    'badge',
    'note',
  ])
    str(source[k], `source.${k}`);
  const url = new URL(source.url as string);
  if (url.protocol !== 'https:') throw Error('Kildelink skal bruge HTTPS');
  for (const key of ['checkedOn', 'documentDate']) {
    const date = source[key] as string;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
      throw Error('Ugyldig kildedato');
  }
  const arena = record(p.arena, 'arena');
  num(arena.width, 'arena.width', 1);
  num(arena.height, 'arena.height', 1);
  arr(arena.letters, 'arena.letters');
  const labels = new Set();
  for (const x of arena.letters) {
    const l = record(x, 'letter');
    str(l.label, 'label');
    num(l.x, 'x');
    num(l.y, 'y');
    if (typeof l.interior !== 'boolean') throw Error('Letter.interior kræves');
    if (labels.has(l.label)) throw Error('Gentaget banebogstav');
    labels.add(l.label);
  }
  arr(p.exercises, 'exercises');
  const ids = new Set();
  p.exercises.forEach((raw, index) => {
    const e = record(raw, 'exercise');
    for (const k of [
      'id',
      'title',
      'location',
      'gaitLabel',
      'description',
      'tip',
    ])
      str(e[k], k);
    if (ids.has(e.id)) throw Error('Gentaget øvelses-id');
    ids.add(e.id);
    if (e.number !== index + 1)
      throw Error('Øvelser skal nummereres fortløbende');
    num(e.sourceNumber, 'sourceNumber', 1);
    arr(e.segments, 'segments');
    optionalBool(e.assessment, 'assessment');
    for (const rawSegment of e.segments) {
      const s = record(rawSegment, 'segment');
      validatePath(s.d);
      if (!['skridt', 'trav', 'galop', 'neutral'].includes(s.gait as string))
        throw Error('Ukendt gangart');
      if (
        s.movement !== undefined &&
        !['normal', 'schenkelvigning', 'versade', 'travers'].includes(
          s.movement as string,
        )
      )
        throw Error('Ukendt linjetype');
      if (s.seconds !== undefined) num(s.seconds, 'seconds', 0.01);
      if (s.heading !== undefined) num(s.heading, 'heading');
      optionalBool(s.reverse, 'reverse');
      optionalBool(s.hidden, 'hidden');
    }
    if (e.size !== undefined) {
      const size = record(e.size, 'size');
      num(size.meters, 'meters', 0.01);
    }
    if (e.assessment) {
      const point = record(e.restingPoint, 'restingPoint');
      num(point.x, 'x');
      num(point.y, 'y');
      num(point.heading, 'heading');
      num(e.assessmentSeconds, 'assessmentSeconds', 0.01);
    }
  });
  return input as Program;
}
export async function loadJson(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw Error(`Filen kunne ikke hentes (${response.status})`);
  return response.json();
}
