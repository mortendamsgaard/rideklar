import fs from 'node:fs';
import { parseCatalog, parseProgram } from '../lib/program.ts';
const root = new URL('../public', import.meta.url);
const catalog = parseCatalog(
  JSON.parse(
    fs.readFileSync(new URL('programs/index.json', root.href + '/'), 'utf8'),
  ),
);
for (const entry of catalog.programs) {
  const p = parseProgram(
    JSON.parse(
      fs.readFileSync(new URL('.' + entry.file, root.href + '/'), 'utf8'),
    ),
  );
  if (p.id !== entry.id) throw Error(`Id mismatch: ${entry.file}`);
  console.log(`${p.title}: ${p.exercises.length} exercises validated`);
}
