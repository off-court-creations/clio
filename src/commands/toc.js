//  ── src/commands/toc.js ────────────────────────────────────────────────────
import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

/*───────────────────────────────────────────────────────────────────────────*/
/* constants */
const GLOSSARY_DIR = 'glossary';
const TOC_MD       = '_gloss_TOC.md';

const TOC_HEADER   = '# Glossary Table of Contents\n\n';

/*───────────────────────────────────────────────────────────────────────────*/
/* public CLI entry‐point */
export async function tocCommand() {
  try {
    const projectRoot = process.cwd();
    const glossaryDir = path.join(projectRoot, GLOSSARY_DIR);

    await ensureStructure(glossaryDir);
    await rebuildTOC(glossaryDir);

    console.log(chalk.green('✓  Glossary TOC rebuilt.'));
  } catch (err) {
    console.error(chalk.red('✖  Failed to rebuild TOC\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* make sure folder + empty TOC exist so the rebuild won’t crash            */
async function ensureStructure(dir) {
  try { await fs.access(dir); }
  catch { await fs.mkdir(dir, { recursive: true }); }

  const tocPath = path.join(dir, TOC_MD);
  try { await fs.access(tocPath); }
  catch { await fs.writeFile(tocPath, TOC_HEADER, 'utf8'); }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* rebuild _gloss_TOC.md from every *.md file in glossary/                  */
async function rebuildTOC(glossaryDir) {
  const tocPath = path.join(glossaryDir, TOC_MD);

  /* gather every *.md file except the TOC itself */
  const files = (await fs.readdir(glossaryDir))
    .filter(f => f !== TOC_MD && path.extname(f) === '.md');

  const entries = [];

  for (const file of files) {
    const full = path.join(glossaryDir, file);
    const firstLine = (await fs.readFile(full, 'utf8'))
      .split('\n')[0]
      .trim();

    const title = firstLine.startsWith('#')
      ? firstLine.replace(/^#+\s*/, '')
      : path.basename(file, '.md');

    entries.push({ title, file });
  }

  /* α‑sort, case‑insensitive */
  entries.sort((a, b) =>
    a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
  );

  const tocBody = entries
    .map(e => `- [${e.title}](./${e.file})`)
    .join('\n');

  const rebuilt = TOC_HEADER + tocBody + '\n';

  await fs.writeFile(tocPath, rebuilt, 'utf8');
}

/*───────────────────────────────────────────────────────────────────────────*/
/* allow `node src/commands/toc.js` for ad‑hoc rebuilding                    */
if (import.meta.url === `file://${process.argv[1]}`) {
  tocCommand();
}
