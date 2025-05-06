//  ── src/commands/toc.js ───────────────────────────────────────────────────
import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { loadClioConfig } from '../utils/clioConfig.js';

/*───────────────────────────────────────────────────────────────────────────*/
const TOC_MD     = '_gloss_TOC.md';
const TOC_HEADER = '# Glossary Table of Contents\n\n';

/*───────────────────────────────────────────────────────────────────────────*/
export async function tocCommand () {
  /* resolve project + glossary dir */
  let meta;
  try { meta = await loadClioConfig(); }
  catch (e) {
    console.error(chalk.red(`✖  ${e.message}`));
    process.exit(1);
  }
  if (!meta) {
    console.error(chalk.red('✖  Not inside a Clio project. Run "clio init" first.'));
    process.exit(1);
  }
  const { glossaryDir } = meta;

  try {
    await ensureStructure(glossaryDir);
    await rebuildTOC(glossaryDir);
    console.log(chalk.green('✓  Glossary TOC rebuilt.'));
  } catch (err) {
    console.error(chalk.red('✖  Failed to rebuild TOC\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
async function ensureStructure (dir) {
  try { await fs.access(dir); }
  catch { await fs.mkdir(dir, { recursive: true }); }

  const tocPath = path.join(dir, TOC_MD);
  try { await fs.access(tocPath); }
  catch { await fs.writeFile(tocPath, TOC_HEADER, 'utf8'); }
}

/*───────────────────────────────────────────────────────────────────────────*/
async function rebuildTOC (glossaryDir) {
  const tocPath = path.join(glossaryDir, TOC_MD);

  const files = (await fs.readdir(glossaryDir))
    .filter(f => f !== TOC_MD && path.extname(f) === '.md');

  const entries = [];
  for (const file of files) {
    const firstLine = (await fs.readFile(path.join(glossaryDir, file), 'utf8'))
      .split('\n')[0]
      .trim();
    const title = firstLine.startsWith('#')
      ? firstLine.replace(/^#+\s*/, '')
      : path.basename(file, '.md');
    entries.push({ title, file });
  }

  entries.sort((a, b) =>
    a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
  );

  const tocBody = entries.map(e => `- [${e.title}](./${e.file})`).join('\n');
  await fs.writeFile(tocPath, TOC_HEADER + tocBody + '\n', 'utf8');
}

/*───────────────────────────────────────────────────────────────────────────*/
/* allow `node src/commands/toc.js` for ad‑hoc rebuilding                    */
if (import.meta.url === `file://${process.argv[1]}`) {
  tocCommand();
}
