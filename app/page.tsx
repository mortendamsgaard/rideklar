'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { loadJson, parseCatalog, parseProgram } from '@/lib/program';
import type { Catalog, Program } from '@/lib/program';
import ProgramPlayer from './program-player';
export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [program, setProgram] = useState<Program | null>(null),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    loadJson('/programs/index.json', controller.signal)
      .then(parseCatalog)
      .then((c) => {
        if (controller.signal.aborted) return;
        setCatalog(c);
        setSelected((previous) =>
          c.programs.some((p) => p.id === previous) ? previous : c.defaultId,
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(String(e.message));
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!catalog || !selected) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const entry = catalog.programs.find((p) => p.id === selected);
    if (!entry) return;
    loadJson(entry.file, controller.signal)
      .then(parseProgram)
      .then((p) => {
        if (p.id !== entry.id)
          throw Error('Programfilens id passer ikke til kataloget');
        if (!controller.signal.aborted) {
          setProgram(p);
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
  }, [catalog, selected]);
  const selector = catalog ? (
    <Select
      value={selected}
      onValueChange={(value) => {
        if (value && value !== selected) {
          request.current?.abort();
          setLoading(true);
          setError('');
          setSelected(value);
        }
      }}
    >
      <SelectTrigger className="program-select" aria-label="Vælg rideprogram">
        <SelectValue>
          {catalog.programs.find((p) => p.id === selected)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {catalog.programs.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;
  if (!program)
    return (
      <main>
        <header>
          <span className="brand">rideklar.</span>
          {selector}
        </header>
        <section className="heading">
          <div role={error ? 'alert' : 'status'}>
            {error
              ? `Programmet kunne ikke indlæses: ${error}`
              : 'Indlæser rideprogram…'}
            {error && (
              <button
                className="primary"
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
        </section>
      </main>
    );
  return (
    <>
      <ProgramPlayer
        key={`${program.id}-${revision}`}
        program={program}
        selector={selector}
        suspended={loading || !!error}
      />
      {(loading || error) && (
        <div className="load-status" role={error ? 'alert' : 'status'}>
          {error
            ? `Programmet kunne ikke indlæses: ${error}`
            : 'Indlæser rideprogram…'}
          {error && (
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
