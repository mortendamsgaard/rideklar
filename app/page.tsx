'use client';
import { useEffect, useState } from 'react';
import { loadJson, parseProgram, resolveStoredProgram } from '@/lib/program';
import type { Program } from '@/lib/program';
import { bundledCatalog, bundledDefault } from '@/lib/bundled-program';
import ProgramPlayer from './program-player';
// The last programme a rider chose, so a return visit resumes where they left
// off. Every access is guarded: localStorage throws outright in some contexts
// (Safari private browsing, blocked site data), and an uncaught throw here
// would break the whole page load, not just this convenience.
const STORAGE_KEY = 'rideklar:program';
function readStoredProgram(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}
function storeProgram(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Nothing to do — the site works fine without remembering.
  }
}
export default function Home() {
  // The default programme is part of the build, so the first render already
  // holds real data and needs no request at all. Only switching to another
  // programme touches the network.
  const [fetched, setFetched] = useState<Program | null>(null),
    [selected, setSelected] = useState(bundledCatalog.defaultId),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0),
    [revision, setRevision] = useState(0);
  const entry = bundledCatalog.programs.find((p) => p.id === selected);
  // Derived rather than stored, so returning to the default programme needs no
  // state update at all, and an unknown selection can never leave the loading
  // overlay up with nothing behind it.
  const program =
    selected === bundledDefault.id
      ? bundledDefault
      : (fetched ?? bundledDefault);
  const shown = error || (entry ? '' : 'Programmet findes ikke i kataloget');
  const busy = loading && !shown;
  useEffect(() => {
    // Tell the layout's boot guard that hydration succeeded, and clean up the
    // cache-busting query it adds when it has to recover a stale page.
    document.documentElement.setAttribute('data-booted', '1');
    if (location.search) history.replaceState({}, '', location.pathname);
    // Restoring the remembered programme has to happen here rather than in a
    // state initialiser: reading localStorage during render would make the
    // client's first render disagree with the prerendered HTML.
    const wanted = resolveStoredProgram(readStoredProgram(), bundledCatalog);
    // Syncing React to an external store (localStorage) after mount is the one
    // case the react-compiler rule's own guidance allows, and it cannot move
    // into render: reading storage during render is precisely what would break
    // hydration. useSyncExternalStore would silence the warning but leaves no
    // way to persist a selection when storage throws, which would break
    // programme switching in private browsing.
    // oxlint-disable-next-line react/react-compiler
    if (wanted !== bundledCatalog.defaultId) setSelected(wanted);
  }, []);
  useEffect(() => {
    // The default ships with the build, and an unknown id is already reported
    // through `shown` above — neither needs a request.
    if (selected === bundledDefault.id) return;
    const target = bundledCatalog.programs.find((p) => p.id === selected);
    if (!target) return;
    const controller = new AbortController();
    loadJson(target.file, controller.signal)
      .then(parseProgram)
      .then((p) => {
        if (p.id !== target.id)
          throw Error('Programfilens id passer ikke til kataloget');
        if (!controller.signal.aborted) {
          setFetched(p);
          setRevision((n) => n + 1);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(String(e.message));
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [selected, retry]);
  const selector = (
    <select
      className="program-select"
      aria-label="Vælg rideprogram"
      value={selected}
      disabled={busy}
      onChange={(event) => {
        const value = event.target.value;
        if (value && value !== selected) {
          setError('');
          // Returning to the bundled default is instant, so it never shows a
          // loading state.
          setLoading(value !== bundledDefault.id);
          setSelected(value);
          storeProgram(value);
        }
      }}
    >
      {bundledCatalog.programs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <ProgramPlayer
        key={`${program.id}-${revision}`}
        program={program}
        selector={selector}
        suspended={busy || !!shown}
      />
      {(busy || shown) && (
        <div className="load-status" role={shown ? 'alert' : 'status'}>
          {shown
            ? `Programmet kunne ikke indlæses: ${shown}`
            : 'Indlæser rideprogram…'}
          {shown && (
            <button
              onClick={() => {
                setLoading(true);
                setError('');
                setRetry((n) => n + 1);
              }}
            >
              Prøv igen
            </button>
          )}
        </div>
      )}
    </>
  );
}
