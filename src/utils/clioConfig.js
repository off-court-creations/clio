//  ── src/utils/clioConfig.js ───────────────────────────────────────────────
import fs   from 'node:fs/promises';
import path from 'node:path';
import { findClioRoot } from './projectRoot.js';

/**
 * Resolve project root and glossary directory.
 * @param {string} [startDir=process.cwd()]
 * @returns {Promise<{ projectRoot:string, glossaryDir:string, config:object }|null>}
 */
export async function loadClioConfig (startDir = process.cwd()) {
  const projectRoot = findClioRoot(startDir);
  if (!projectRoot) return null;

  const cfgPath = path.join(projectRoot, '.clio', 'config.json');
  let cfg;
  try {
    cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8'));
  } catch {
    throw new Error(`Cannot read ${cfgPath}. Was "clio init" run?`);
  }

  const glossaryDir = path.join(projectRoot, cfg.glossaryDir || 'glossary');
  return { projectRoot, glossaryDir, config: cfg };
}
