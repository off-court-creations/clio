//  ── src/commands/stats.js ────────────────────────────────────────────────
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

const GLOSSARY_DIR = 'glossary';
const TOC_MD       = '_gloss_TOC.md';
const ENTRY_REGEX  = /```glossary-entry\s*([\s\S]*?)```/;
const GLOSSARY_LINK_RE = /\[[^\]]+]\([^)]*?glossary\/[^)]+\)/gi;

/*───────────────────────────────────────────────────────────────────────────*/

export async function statsCommand () {
  try {
    const root = process.cwd();
    const glossaryDir = path.join(root, GLOSSARY_DIR);

    const glossary = await loadGlossary(glossaryDir);
    const docCounts = await countLinksInDocs(root);

    /* ── report ────────────────────────────────────────────────────────── */
    console.log(chalk.bold('\n📊  Documentation Glossary Stats\n'));

    /* total */
    console.log(`• Total terms: ${chalk.cyan(glossary.length)}`);

    /* orphan */
    const orphans = glossary.filter(g => !(g.data.mentionedOnPages ?? []).length);
    console.log(`• Orphan terms (never referenced): ` +
      chalk.cyan(`${orphans.length}`) +
      (orphans.length ? '  →  ' + orphans.slice(0, 10).map(o => o.data.singular).join(', ') +
        (orphans.length > 10 ? ', …' : '') : '')
    );

    /* top terms */
    const topTerms = [...glossary]
      .sort((a,b)=>(b.data.mentionedOnPages?.length||0) - (a.data.mentionedOnPages?.length||0))
      .slice(0,5);
    console.log('\nTop 5 most‑linked terms:');
    topTerms.forEach(t => {
      const n = t.data.mentionedOnPages?.length || 0;
      console.log(`  • ${t.data.singular.padEnd(20)}  ${chalk.yellow(n)} link${n!==1?'s':''}`);
    });

    /* top docs */
    const topDocs = [...docCounts.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,5);
    console.log('\nDocs with most glossary links:');
    topDocs.forEach(([file, n]) => {
      console.log(`  • ${file.padEnd(40)}  ${chalk.yellow(n)}`);
    });

    console.log();
  } catch (err) {
    console.error(chalk.red('✖  stats failed\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* helpers */

async function loadGlossary (dir) {
  const files = (await fs.readdir(dir))
    .filter(f => f.endsWith('.md') && f !== TOC_MD);

  const out = [];
  for (const f of files) {
    const txt = await fs.readFile(path.join(dir, f), 'utf8');
    const m = txt.match(ENTRY_REGEX);
    if (!m) continue;
    try { out.push({ file: f, data: JSON.parse(m[1]) }); }
    catch { /* skip invalid json */ }
  }
  return out;
}

async function countLinksInDocs (root) {
  const counts = new Map();

  const walk = async dir => {
    for (const d of await fs.readdir(dir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        if (['node_modules', '.vitepress', GLOSSARY_DIR].includes(d.name)) continue;
        await walk(path.join(dir, d.name));
      } else if (d.name.endsWith('.md')) {
        const file = path.join(dir, d.name);
        const txt  = await fs.readFile(file, 'utf8');
        const n    = (txt.match(GLOSSARY_LINK_RE) || []).length;
        if (n) counts.set(path.relative(root, file), n);
      }
    }
  };

  await walk(root);
  return counts;
}
