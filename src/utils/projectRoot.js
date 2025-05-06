//  ── src/utils/projectRoot.js ──────────────────────────────────────────────
import fs   from 'node:fs';
import path from 'node:path';

/* walk up from start dir looking for ".clio" folder */
export function findClioRoot (startDir = process.cwd()) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, '.clio'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;          // reached FS root
    dir = parent;
  }
}
