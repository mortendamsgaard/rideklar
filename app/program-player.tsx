'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The interactive SVG arena needs an accessible image role. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
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
import { gaitColors, lineDash, markerAngle, zigzagPath } from './ride-style';
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
    [expandedFor, setExpandedFor] = useState(-1),
    [clipped, setClipped] = useState(false),
    [playing, setPlaying] = useState(false),
    [fraction, setFraction] = useState(0),
    [restart, setRestart] = useState(0);
  const marker = useRef<SVGGElement>(null),
    drawnPaths = useRef<(SVGPathElement | null)[]>([]),
    elapsed = useRef(0),
    currentRow = useRef<HTMLButtonElement>(null);
  const rows = program.exercises,
    arena = program.arena,
    row = rows[index],
    segments = row.segments,
    lastVisible = segments.reduce((last, s, i) => (s.hidden ? last : i), -1);
  // Derived, not stored: switching exercise collapses the text for free.
  const expanded = expandedFor === index;
  function reset() {
    elapsed.current = 0;
    setFraction(0);
    setRestart((n) => n + 1);
  }
  function choose(i: number) {
    if (i < 0 || i >= rows.length) return;
    setIndex(i);
    setPlaying(false);
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
          markerAngle(
            segment.movement,
            after.x - before.x,
            after.y - before.y,
            segment.reverse,
            q.x,
            arena.width / 2,
          ));
      marker.current?.setAttribute(
        'transform',
        `translate(${q.x} ${q.y}) rotate(${angle})`,
      );
      marker.current?.style.setProperty('color', gaitColors[segment.gait]);
    }
    position(elapsed.current);
    function tick(time: number) {
      if (last !== null) elapsed.current += Math.min((time - last) / 1000, 0.1);
      last = time;
      const f = Math.min(1, elapsed.current / total);
      setFraction(f);
      position(Math.min(total, elapsed.current));
      if (f === 1) {
        if (index < rows.length - 1) {
          elapsed.current = 0;
          setFraction(0);
          setIndex(index + 1);
        } else {
          setPlaying(false);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    if (playing && !suspended) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    row,
    segments,
    playing,
    index,
    rows.length,
    restart,
    suspended,
    arena.width,
  ]);
  useEffect(() => {
    const el = currentRow.current;
    const list = el?.parentElement;
    if (!el || !list || list.scrollHeight <= list.clientHeight) return;
    list.scrollTo({
      top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [index]);
  function play() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (fraction >= 1) reset();
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
        <div className="exercise-head" aria-live="polite">
          <span className="eyebrow">
            ØVELSE {String(index + 1).padStart(2, '0')} / {rows.length} ·{' '}
            {row.gaitLabel}
          </span>
          <h2>{row.title}</h2>
          <span className="at">{row.location}</span>
          <p
            ref={(el) => {
              if (el && !expanded)
                setClipped(el.scrollHeight > el.clientHeight + 1);
            }}
            className={expanded ? 'description expanded' : 'description'}
            {...(clipped && {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': expanded,
              title: expanded ? 'Vis mindre' : 'Vis hele teksten',
              onClick: () => setExpandedFor(expanded ? -1 : index),
              onKeyDown: (event: KeyboardEvent<HTMLParagraphElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setExpandedFor(expanded ? -1 : index);
                }
              },
            })}
          >
            {row.description}
          </p>
        </div>
        <section className="stage">
          <div className="arena-wrap">
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
                    fill={interior ? '#8a6c3e' : '#7a5a30'}
                    fontWeight="600"
                  >
                    {l}
                  </text>
                  {!interior && (x < 0 || x > arena.width) && (
                    <path
                      d={`M${x < 0 ? -0.4 : arena.width} ${y}h.4`}
                      stroke="#96601f"
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
              {/* A pony seen from above, drawn at its real footprint: the arena
                  is in metres, so this is ~2.5 m nose to rump and 0.84 m across
                  the barrel. +x is the direction of travel, so the head leads. */}
              <g ref={marker} style={{ color: gaitColors[segments[0].gait] }}>
                <ellipse rx="1.6" ry=".75" fill="currentColor" opacity=".14" />
                <path
                  d="M-1.18 0 C-1.34 .03 -1.48 .08 -1.6 .16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth=".11"
                  strokeLinecap="round"
                />
                <path
                  d="M1.35 0
                     C1.33 .09 1.27 .14 1.18 .15
                     C1.05 .17 .88 .19 .72 .27
                     C.5 .37 .3 .42 .1 .42
                     L-.5 .42
                     C-.85 .42 -1.02 .34 -1.1 .22
                     C-1.16 .12 -1.18 .06 -1.18 0
                     C-1.18 -.06 -1.16 -.12 -1.1 -.22
                     C-1.02 -.34 -.85 -.42 -.5 -.42
                     L.1 -.42
                     C.3 -.42 .5 -.37 .72 -.27
                     C.88 -.19 1.05 -.17 1.18 -.15
                     C1.27 -.14 1.33 -.09 1.35 0 Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth=".11"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
        </section>
        <div className="controls-primary">
          <button
            className="step"
            aria-label="Forrige øvelse"
            disabled={suspended || index === 0}
            onClick={() => choose(index - 1)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="play-all"
            disabled={suspended}
            aria-label={playing ? 'Pause' : 'Afspil programmet'}
            onClick={play}
          >
            <span
              className="play-fill"
              aria-hidden="true"
              style={{
                width: `${((index + fraction) / rows.length) * 100}%`,
              }}
            />
            <span className="play-label">
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </span>
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
                <path
                  d="M1 6H31"
                  strokeDasharray="0.1 4"
                  strokeLinecap="round"
                />
              </svg>
              Travers
            </span>
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
                ref={i === index ? currentRow : undefined}
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
      </div>
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
        <p className="copyright">
          © {new Date().getFullYear()} Morten Damsgaard
        </p>
      </footer>
    </main>
  );
}
