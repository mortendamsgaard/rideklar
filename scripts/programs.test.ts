import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseProgram,
  parseCatalog,
  validatePath,
  loadJson,
} from '../lib/program.ts';
import { timeline, timelinePosition } from '../lib/animation.ts';
import type { Segment } from '../lib/program.ts';
const read = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../public/programs/${name}`, import.meta.url),
      'utf8',
    ),
  );
const catalog = parseCatalog(read('index.json'));
const programs = catalog.programs.map((p) =>
  parseProgram(read(p.file.split('/').pop()!)),
);
function near(a: number[], b: number[], label = '') {
  assert.equal(a.length, b.length);
  a.forEach((x, i) =>
    assert.ok(
      Math.abs(x - b[i]) < 1e-6,
      `${label}: ${a.join(',')} ≠ ${b.join(',')}`,
    ),
  );
}
// Independent sampling of the authored paths checks endpoints, scale and boundaries.
function sample(d: string) {
  const commands = d.match(/[MLQCA][^MLQCA]*/g)!;
  let current = [0, 0];
  const out: number[][] = [];
  for (const command of commands) {
    const k = command[0],
      v = command.slice(1).trim().split(/[ ,]+/).map(Number),
      start = current.slice(),
      end = v.slice(-2);
    if (k === 'M') {
      current = end;
      out.push(end);
      continue;
    }
    for (let i = 1; i <= 80; i++) {
      const t = i / 80,
        u = 1 - t;
      let p: number[];
      if (k === 'L') p = start.map((x, j) => x * u + end[j] * t);
      else if (k === 'Q')
        p = start.map((x, j) => u * u * x + 2 * u * t * v[j] + t * t * end[j]);
      else if (k === 'C')
        p = start.map(
          (x, j) =>
            u * u * u * x +
            3 * u * u * t * v[j] +
            3 * u * t * t * v[j + 2] +
            t * t * t * end[j],
        );
      else {
        const [r, ry, rotation, large, sweep] = v;
        assert.equal(r, ry);
        assert.equal(rotation, 0);
        const dx = (start[0] - end[0]) / 2,
          dy = (start[1] - end[1]) / 2,
          q = dx * dx + dy * dy;
        assert.ok(q <= r * r + 1e-6);
        const sign = large === sweep ? -1 : 1,
          f = sign * Math.sqrt(Math.max(0, (r * r - q) / q)),
          cx = (start[0] + end[0]) / 2 + f * dy,
          cy = (start[1] + end[1]) / 2 - f * dx,
          a = Math.atan2(start[1] - cy, start[0] - cx);
        let delta = Math.atan2(end[1] - cy, end[0] - cx) - a;
        if (sweep && delta < 0) delta += Math.PI * 2;
        if (!sweep && delta > 0) delta -= Math.PI * 2;
        p = [
          cx + r * Math.cos(a + delta * t),
          cy + r * Math.sin(a + delta * t),
        ];
      }
      out.push(p);
    }
    current = end;
  }
  return out;
}
void test('catalog loads all 28 independent, versioned fixed programs', () => {
  assert.equal(programs.length, 28);
  assert.equal(programs.find((p) => p.title === 'LA1-B')!.exercises.length, 20);
  assert.equal(programs.find((p) => p.title === 'LA4-B')!.exercises.length, 23);
  programs.forEach((p, i) => assert.equal(p.id, catalog.programs[i].id));
});
for (const p of programs)
  void test(`${p.title}: every authored path stays inside the arena and connects`, () => {
    let end: number[] | undefined;
    for (const e of p.exercises) {
      if (e.assessment) {
        near(end!, [e.restingPoint!.x, e.restingPoint!.y], e.title);
        continue;
      }
      for (const s of e.segments) {
        const points = sample(s.d);
        if (end) near(end, points[0], e.title);
        for (const [x, y] of points) {
          assert.ok(
            x >= -1e-6 && x <= p.arena.width + 1e-6,
            `${e.title} x=${x}`,
          );
          assert.ok(
            y >= -1e-6 && y <= p.arena.height + 1e-6,
            `${e.title} y=${y}`,
          );
        }
        end = points.at(-1);
      }
    }
  });
void test('LA1 side steps and LA4 versades retain their official sections', () => {
  const a = programs.find((p) => p.title === 'LA1-B')!,
    b = programs.find((p) => p.title === 'LA4-B')!;
  assert.deepEqual(
    a.exercises
      .filter((e) => e.segments.some((s) => s.movement === 'schenkelvigning'))
      .map((e) => e.number),
    [3, 7],
  );
  assert.deepEqual(
    b.exercises
      .filter((e) => e.segments.some((s) => s.movement === 'versade'))
      .map((e) => e.number),
    [2, 4],
  );
  assert.deepEqual(
    b.exercises[15].segments.map((s) => s.gait),
    ['galop', 'skridt', 'galop'],
  );
  assert.deepEqual(
    b.exercises[19].segments.map((s) => s.gait),
    ['galop', 'trav'],
  );
  for (const i of [14, 16]) {
    assert.equal(b.exercises[i].size!.meters, 8);
    assert.equal(b.exercises[i].segments[0].d.match(/A4 4/g)!.length, 2);
  }
  for (const i of [10, 12]) assert.equal(a.exercises[i].size!.meters, 10);
});
void test('timeline is generic and pauses and reverse movement are data', () => {
  const segments: Segment[] = [
    { d: 'M0 0 L10 0', gait: 'trav', seconds: 3 },
    { d: 'M10 0', gait: 'neutral', seconds: 2, hidden: true },
    { d: 'M10 0 L8 0', gait: 'neutral', seconds: 4, reverse: true },
  ];
  const times = timeline(segments, [10, 0, 2]);
  assert.deepEqual(times, [3, 2, 4]);
  assert.deepEqual(timelinePosition(3, times), { index: 1, fraction: 0 });
  assert.deepEqual(timelinePosition(7, times), { index: 2, fraction: 0.5 });
  assert.deepEqual(timelinePosition(99, times), { index: 2, fraction: 1 });
});
void test('a newly named program is accepted without any renderer-specific registration', () => {
  const p = structuredClone(programs[0]);
  p.id = 'future-program';
  p.title = 'Nyt program';
  p.exercises = p.exercises.slice(0, 2);
  assert.equal(parseProgram(p).exercises.length, 2);
  const code = fs.readFileSync(
    new URL('../app/program-player.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(code, /LA1|LA4|la1-b|la4-b|index\s*===\s*(?:10|15|22)/);
});
void test('invalid data fails explicitly', () => {
  for (const mutate of [
    (p: {
      schemaVersion: number;
      source: { url: string };
      exercises: {
        number: number;
        segments: { gait: string; seconds?: number }[];
      }[];
    }) => (p.schemaVersion = 2),
    (p: {
      schemaVersion: number;
      source: { url: string };
      exercises: {
        number: number;
        segments: { gait: string; seconds?: number }[];
      }[];
    }) => (p.exercises = []),
    (p: {
      schemaVersion: number;
      source: { url: string };
      exercises: {
        number: number;
        segments: { gait: string; seconds?: number }[];
      }[];
    }) => (p.exercises[0].segments[0].gait = 'tolt'),
    (p: {
      schemaVersion: number;
      source: { url: string };
      exercises: {
        number: number;
        segments: { gait: string; seconds?: number }[];
      }[];
    }) => (p.exercises[0].number = 8),
    (p: {
      schemaVersion: number;
      source: { url: string };
      exercises: {
        number: number;
        segments: { gait: string; seconds?: number }[];
      }[];
    }) => (p.exercises[0].segments[0].seconds = -2),
    (p: {
      schemaVersion: number;
      source: { url: string };
      exercises: {
        number: number;
        segments: { gait: string; seconds?: number }[];
      }[];
    }) => (p.source.url = 'javascript:alert(1)'),
  ]) {
    const p = structuredClone(programs[0]);
    mutate(p);
    assert.throws(() => parseProgram(p));
  }
  assert.throws(() => validatePath('M0 0 L5'));
  assert.throws(() => validatePath('<script>'));
  assert.throws(() =>
    parseCatalog({ schemaVersion: 1, defaultId: 'x', programs: [] }),
  );
});
void test('loading preserves cancellation and reports failed requests', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options!.signal, controller.signal);
      return new Response('missing', { status: 404 });
    };
    await assert.rejects(
      loadJson('/programs/missing.json', controller.signal),
      /404/,
    );
    globalThis.fetch = async () => new Response('{broken');
    await assert.rejects(loadJson('/programs/broken.json', controller.signal));
  } finally {
    globalThis.fetch = original;
  }
});

void test('all programs preserve source coverage, pony diameters and assessment-only rows', () => {
  const fixtures = JSON.parse(
    fs.readFileSync(
      new URL('./fixtures/drf-programs.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(
    programs.reduce((sum, p) => sum + p.exercises.length, 0),
    547,
  );
  for (const fixture of fixtures) {
    const p = programs.find((p) => p.id === fixture.id)!;
    assert.equal(p.arena.height, fixture.arenaHeight, p.id);
    assert.deepEqual(
      p.exercises.map((e) => e.sourceNumber),
      fixture.sourceNumbers,
      p.id,
    );
    assert.deepEqual(
      p.exercises.filter((e) => e.assessment).map((e) => e.number),
      fixture.assessmentNumbers,
      p.id,
    );
    for (const [number, diameter] of Object.entries(fixture.circles)) {
      const e = p.exercises[Number(number) - 1];
      assert.equal(e.size?.meters, diameter, `${p.id} circle ${number}`);
      const radius = Number(diameter) / 2;
      assert.ok(
        e.segments.some((s) => s.d.includes(`A${radius} ${radius} `)),
        `${p.id} circle geometry ${number}`,
      );
    }
    for (const [movement, numbers] of Object.entries(fixture.movements)) {
      assert.deepEqual(
        p.exercises
          .filter(
            (e) =>
              !e.assessment && e.segments.some((s) => s.movement === movement),
          )
          .map((e) => e.number),
        numbers,
        `${p.id} ${movement}`,
      );
    }
    for (const [number, gait] of Object.entries(fixture.gaitChanges)) {
      const segments = p.exercises[Number(number) - 1].segments;
      const middle = segments.findIndex((s) => s.gait === gait);
      assert.ok(
        middle >= 0,
        `${p.id} change ${number} must use ${String(gait)}`,
      );
      assert.ok(
        segments.slice(middle + 1).some((s) => s.gait === 'galop'),
        `${p.id} change ${number} must resume canter`,
      );
    }
    assert.doesNotMatch(
      JSON.stringify(p),
      /AUTOMATISK UDKAST|automatisk udkast|landmark-only/,
    );
  }
});

void test('stationary markers stay at their authored position', async () => {
  const { stationaryPosition } = await import('../lib/animation.ts');
  assert.deepEqual(stationaryPosition('M10 60'), { x: 10, y: 60 });
  assert.deepEqual(stationaryPosition('M10, 6'), { x: 10, y: 6 });
});

void test('freestyle files preserve requirements without inventing fixed routes', () => {
  for (const name of ['la-kur-pony', 'la6-kur-pony', 'pony-kur-pony']) {
    const p = read(`freestyle/${name}.json`);
    assert.equal(p.kind, 'freestyle');
    assert.equal(p.exercises, undefined);
    assert.equal(
      p.technicalRequirements.length,
      name === 'la-kur-pony' ? 14 : 15,
    );
    assert.equal(p.artisticAssessments.length, 5);
    assert.ok(!catalog.programs.some((entry) => entry.id === name));
    const total = [...p.technicalRequirements, ...p.artisticAssessments].reduce(
      (sum, row) => sum + row.maxMark * row.coefficient,
      0,
    );
    assert.equal(total, p.maxScore);
    assert.equal(p.duration.requiresClarification, name === 'la6-kur-pony');
  }
});
