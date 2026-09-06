'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The interactive SVG arena needs an accessible image role. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  Lightbulb,
  Check,
  Route,
} from 'lucide-react';
import type { Program } from '@/lib/program';
import {
  timeline,
  timelinePosition,
  stationaryPosition,
} from '@/lib/animation';
import { gaitColors, lineDash, zigzagPath } from './ride-style';
export default function ProgramPlayer({
  program,
  selector,
  suspended,
}: {
  program: Program;
  selector: ReactNode;
  suspended: boolean;
}) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [all, setAll] = useState(false),
    [fraction, setFraction] = useState(0),
    [restart, setRestart] = useState(0);
  const marker = useRef<SVGGElement>(null),
    label = useRef<HTMLSpanElement>(null),
    drawnPaths = useRef<(SVGPathElement | null)[]>([]),
    elapsed = useRef(0);
  const rows = program.exercises,
    arena = program.arena,
    row = rows[index],
    segments = row.segments,
    lastVisible = segments.reduce((last, s, i) => (s.hidden ? last : i), -1);
  function reset() {
    elapsed.current = 0;
    setFraction(0);
    setRestart((n) => n + 1);
  }
  function choose(i: number) {
    if (i < 0 || i >= rows.length) return;
    setIndex(i);
    setPlaying(false);
    setAll(false);
    reset();
  }
  useEffect(() => {
    let frame = 0,
      last: number | null = null;
    const paths = segments.map((s) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', s.d);
      return p;
    });
    const lengths = paths.map((p) => p.getTotalLength()),
      durations = timeline(segments, lengths),
      total = row.assessment
        ? row.assessmentSeconds!
        : durations.reduce((a, b) => a + b, 0);
    segments.forEach((s, i) =>
      drawnPaths.current[i]?.setAttribute(
        'd',
        s.movement === 'versade' ? zigzagPath(paths[i]) : s.d,
      ),
    );
    function position(seconds: number) {
      const current = timelinePosition(seconds, durations),
        segment = segments[current.index],
        p = paths[current.index],
        len = lengths[current.index],
        distance = len * current.fraction;
      const q = row.assessment
          ? row.restingPoint!
          : len === 0
            ? stationaryPosition(segment.d)
            : p.getPointAtLength(distance),
        before =
          len === 0 ? q : p.getPointAtLength(Math.max(0, distance - 0.08)),
        after =
          len === 0 ? q : p.getPointAtLength(Math.min(len, distance + 0.08));
      const angle = row.assessment
        ? row.restingPoint!.heading
        : (segment.heading ??
          (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI +
            (segment.reverse ? 180 : 0));
      marker.current?.setAttribute(
        'transform',
        `translate(${q.x} ${q.y}) rotate(${angle})`,
      );
      marker.current?.style.setProperty('color', gaitColors[segment.gait]);
      if (label.current)
        label.current.textContent = segment.label ?? row.gaitLabel;
    }
    position(elapsed.current);
    function tick(time: number) {
      if (last !== null) elapsed.current += Math.min((time - last) / 1000, 0.1);
      last = time;
      const f = Math.min(1, elapsed.current / total);
      setFraction(f);
      position(Math.min(total, elapsed.current));
      if (f === 1) {
        if (all && index < rows.length - 1) {
          elapsed.current = 0;
          setFraction(0);
          setIndex(index + 1);
        } else {
          setPlaying(false);
          setAll(false);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    if (playing && !suspended) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [row, segments, playing, all, index, rows.length, restart, suspended]);
  function play(full: boolean) {
    if (playing && all === full) {
      setPlaying(false);
      return;
    }
    if (full && !all) {
      reset();
      setIndex(0);
    } else if (fraction >= 1) {
      reset();
      if (full && index === rows.length - 1) setIndex(0);
    }
    setAll(full);
    setPlaying(true);
  }
  return (
    <main>
      <h1 className="sr-only">
        {program.title} · {program.audience}
      </h1>
      <header className="app-header">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Route size={20} />
          </span>
          rideklar<span className="brand-dot">.</span>
        </Link>
        <div className="header-meta">
          <span className="header-arena">
            {arena.width} × {arena.height} m
          </span>
          {selector}
        </div>
      </header>
      <div className="workspace">
        <section className="stage">
          <div className="arena-wrap">
            <div className="arena-note">
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span ref={label}>{row.gaitLabel}</span>
            </div>
            <svg
              className="arena"
              viewBox={`-5 -5 ${arena.width + 10} ${arena.height + 10}`}
              role="img"
              aria-label={`${arena.width} gange ${arena.height} meter dressurbane. Øvelse ${index + 1}: ${row.title}. Ridevej ${row.location}`}
            >
              <defs>
                <pattern
                  id="sand"
                  width="1"
                  height="1"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx=".5" cy=".5" r=".025" fill="#d8c39c" />
                </pattern>
                {Object.entries(gaitColors).map(([gait, color]) => (
                  <marker
                    key={gait}
                    id={`arrow-${gait}`}
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="3"
                    markerHeight="3"
                    orient="auto-start-reverse"
                  >
                    <path d="M0 0 L10 5 L0 10 Z" fill={color} />
                  </marker>
                ))}
              </defs>
              <rect
                x="-.4"
                y="-.4"
                width={arena.width + 0.8}
                height={arena.height + 0.8}
                rx=".4"
                fill="#fffdf8"
                stroke="#e2d0b0"
                strokeWidth=".12"
              />
              <rect width={arena.width} height={arena.height} fill="#f2e4cc" />
              <rect
                width={arena.width}
                height={arena.height}
                fill="url(#sand)"
              />
              <path
                d={`M${arena.width / 2} 0V${arena.height} M0 ${arena.height / 2}H${arena.width}`}
                stroke="#d8c39c"
                strokeDasharray=".3 .5"
                strokeWidth=".08"
              />
              {arena.letters.map(({ label: l, x, y, interior }) => (
                <g key={l}>
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={interior ? '.85' : '1.1'}
                    fill={interior ? '#a58a5e' : '#7a5a30'}
                    fontWeight="600"
                  >
                    {l}
                  </text>
                  {!interior && (x < 0 || x > arena.width) && (
                    <path
                      d={`M${x < 0 ? -0.4 : arena.width} ${y}h.4`}
                      stroke="#b5722a"
                      strokeWidth=".15"
                    />
                  )}
                </g>
              ))}
              {segments.map((segment, i) =>
                segment.hidden ? null : (
                  <path
                    key={`${row.id}-${i}`}
                    ref={(node) => {
                      drawnPaths.current[i] = node;
                    }}
                    d={segment.d}
                    fill="none"
                    stroke={gaitColors[segment.gait]}
                    strokeWidth={segment.gait === 'neutral' ? '.4' : '.25'}
                    strokeDasharray={lineDash(segment.movement)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={row.assessment ? 0.55 : 1}
                    markerEnd={
                      !row.assessment && i === lastVisible
                        ? `url(#arrow-${segment.gait})`
                        : undefined
                    }
                  />
                ),
              )}
              <g ref={marker} style={{ color: gaitColors[segments[0].gait] }}>
                <circle r=".85" fill="currentColor" opacity=".15" />
                <circle
                  r=".52"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth=".15"
                />
                <path
                  d="M.05 -.2 L.35 0 L.05 .2"
                  fill="none"
                  stroke="white"
                  strokeWidth=".09"
                />
              </g>
            </svg>
            <span className="dimension">{arena.width} m</span>
          </div>
        </section>
        <div className="exercise-head" aria-live="polite">
          <span className="eyebrow">
            ØVELSE {String(index + 1).padStart(2, '0')} / {rows.length} ·{' '}
            {row.gaitLabel}
          </span>
          <h2>
            {row.title} <span className="at">· {row.location}</span>
          </h2>
          <p className="description">{row.description}</p>
        </div>
        <div className="controls-primary">
          <button
            className="play-all"
            disabled={suspended}
            onClick={() => play(true)}
          >
            <span
              className="play-fill"
              aria-hidden="true"
              style={{ width: `${all ? fraction * 100 : 0}%` }}
            />
            <span className="play-label">
              {playing && all ? <Pause size={17} /> : <Play size={17} />}
              {playing && all ? 'Pause program' : 'Afspil hele programmet'}
            </span>
          </button>
        </div>
        <div className="controls-secondary">
          <button
            className="step"
            aria-label="Forrige øvelse"
            disabled={suspended || index === 0}
            onClick={() => choose(index - 1)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="play-one"
            disabled={suspended}
            onClick={() => play(false)}
          >
            {playing && !all ? <Pause size={16} /> : <Play size={16} />}
            {playing && !all ? 'Pause' : 'Øvelsen'}
          </button>
          <button
            className="step"
            aria-label="Næste øvelse"
            disabled={suspended || index === rows.length - 1}
            onClick={() => choose(index + 1)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <aside className="detail">
          <div className="detail-content" aria-live="polite">
            <div className="tip">
              <Lightbulb size={22} />
              <div>
                <h3>Tag det med i sadlen</h3>
                <p>{row.tip}</p>
              </div>
            </div>
            {row.size && (
              <div className="size-note">
                <b>{row.size.meters} meter</b>
                <span>{row.size.description}</span>
              </div>
            )}
            <p className="schematic">{row.note}</p>
          </div>
          <div className="next-preview">
            {index < rows.length - 1 ? (
              <>
                HEREFTER <span>{rows[index + 1].title}</span>
              </>
            ) : (
              <>
                PROGRAMMET ER SLUT <span>God træning!</span>
              </>
            )}
          </div>
        </aside>
        <div
          className="route-key"
          aria-label="Forklaring af ridevejens farver og linjetyper"
        >
          <div className="legend">
            {(['skridt', 'trav', 'galop'] as const).map((g) => (
              <span key={g}>
                <i style={{ background: gaitColors[g] }} />
                {g[0].toUpperCase() + g.slice(1)}
              </span>
            ))}
            <span>
              <i style={{ background: gaitColors.neutral }} />
              Parade / tilbage
            </span>
          </div>
          <div className="legend movement-key">
            <span>
              <svg viewBox="0 0 32 12" aria-hidden="true">
                <path d="M1 6H31" strokeDasharray="4 3" />
              </svg>
              Schenkelvigning
            </span>
            <span>
              <svg viewBox="0 0 32 12" aria-hidden="true">
                <path d="M1 6L6 2L11 10L16 2L21 10L26 2L31 6" />
              </svg>
              Versade
            </span>
            <span>
              <svg viewBox="0 0 32 12" aria-hidden="true">
                <path d="M1 6H31" />
              </svg>
              Travers
            </span>
          </div>
          <p>{program.legendNote}</p>
        </div>
      </div>
      <section className="program">
        <div className="program-heading">
          <h2>Hele programmet</h2>
          <span>Vælg en øvelse og find din vej</span>
        </div>
        <div className="program-list">
          {rows.map((r, i) => (
            <button
              key={r.id}
              disabled={suspended}
              className={i === index ? 'program-row current' : 'program-row'}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => choose(i)}
            >
              <span className="row-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="row-title">{r.title}</span>
            </button>
          ))}
        </div>
      </section>
      <footer>
        <p className="footer-meta">
          {program.title} · {program.audience} · {rows.length} øvelser ·{' '}
          <span className="verified">
            <Check size={13} /> {program.source.badge}
          </span>
        </p>
        <p>{program.disclaimer}</p>
        <p>
          {program.source.note}{' '}
          <a href={program.source.url} target="_blank" rel="noreferrer">
            Se protokollen ↗
          </a>
        </p>
      </footer>
    </main>
  );
}
