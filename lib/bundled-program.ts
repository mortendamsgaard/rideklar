import catalogJson from '../public/programs/index.json';
import defaultJson from '../public/programs/la4-b-pony.json';
import { parseCatalog, parseProgram } from './program';

// The catalog and the default programme ship inside the build instead of being
// fetched, so the very first render already holds real data. That is what puts
// the arena and the exercise text into the static HTML: a rider whose JS never
// boots still gets a readable programme rather than a loading screen. Both are
// validated here, at module load, so bad data fails the build, not the browser.
export const bundledCatalog = parseCatalog(catalogJson);
export const bundledDefault = parseProgram(defaultJson);
