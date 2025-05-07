import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
const Separator = inquirer.Separator;
import Fuse from 'fuse.js';

import { loadClioConfig } from '../utils/clioConfig.js';
import { addCommand }     from './add.js';

const ENTRY_REGEX = /```json\s*([\s\S]*?)```/;
const CODE_FENCE  = /```[\s\S]*?```/g;
const TOC_MD      = '_gloss_TOC.md';

/*───────────────────────────────────────────────────────────────────────────*/
export async function suggestCommand () {
  /* project & config */
  const meta = await loadClioConfig().catch(e => {
    console.error(chalk.red(`✖  ${e.message}`)); process.exit(1);
  });
  if (!meta) {
    console.error(chalk.red('✖  Not inside a Clio project. Run "clio init" first.'));
    process.exit(1);
  }
  const { projectRoot, glossaryDir, config } = meta;

  /* ── load ignore list from separate file ───────────────────────────── */
  const ignorePath = path.join(projectRoot, '.clio', config.ignoreFile || 'ignore.txt');
  let ignoreSet = new Set();
  try {
    const raw = await fs.readFile(ignorePath, 'utf8');
    raw.split(/\s+/).forEach(w => w && ignoreSet.add(w.toLowerCase()));
  } catch {
    /* file may not exist yet */
  }

  /* known glossary + scan */
  const known  = await loadGlossaryTerms(glossaryDir);
  const stats  = await scanDocs(projectRoot, glossaryDir, known, ignoreSet);

  if (!stats.clusters.length) {
    console.log(chalk.yellow('No candidate terms found – nice!'));
    return;
  }

  const shown = stats.clusters.slice(0, 30);

  /* checkbox for ignore list */
  const ignoreChoices = [
    new Separator('─── start ───'),
    ...shown.map(c => ({
      name : `${c.members[0]} (${c.total})`,
      value: c.members[0]
    })),
    new Separator('─── end (wraps) ───')
  ];

  const { toIgnore } = await inquirer.prompt([{
    name   : 'toIgnore',
    type   : 'checkbox',
    message: 'Select terms to add to ignore list:',
    loop   : true,
    pageSize: 20,
    choices: ignoreChoices
  }]);

  /* update ignore set immediately */
  toIgnore.forEach(w => ignoreSet.add(w));

  /* persist ignore file if needed */
  if (toIgnore.length) {
    await fs.writeFile(ignorePath, [...ignoreSet].sort().join('\n') + '\n', 'utf8');
    console.log(chalk.green(`✓  Added ${toIgnore.length} word(s) to ignore list.`));
  }

  /* second checkbox – queue for add (excluding ignores) */
  const addableChoices = [
    new Separator('─── start ───'),
    ...shown
      .filter(c => !ignoreSet.has(c.members[0]))
      .map(c => ({
        name : `${c.members[0]} (${c.total})`,
        value: c.members[0]
      })),
    new Separator('─── end (wraps) ───')
  ];

  let toAdd = [];
  if (addableChoices.length > 2) {
    ({ toAdd } = await inquirer.prompt([{
      name   : 'toAdd',
      type   : 'checkbox',
      message: 'Select terms to queue for glossary creation:',
      loop   : true,
      pageSize: 20,
      choices: addableChoices
    }]));
  }

  /* sequentially run add for each queued term */
  for (const term of toAdd) {
    console.log(chalk.blue(`\n— Adding “${term}” —`));
    await addCommand({ prefillSingular: term });
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
async function loadGlossaryTerms (dir) {
  const set = new Set();
  for (const f of (await fs.readdir(dir)).filter(x => x.endsWith('.md'))) {
    const m = (await fs.readFile(path.join(dir, f), 'utf8')).match(ENTRY_REGEX);
    if (!m) continue;
    const d = JSON.parse(m[1]);
    [
      d.singular, d.plural,
      ...d.alternates.map(a => a.singular),
      ...d.alternates.filter(a => a.plural).map(a => a.plural)
    ].filter(Boolean).forEach(t => set.add(t.toLowerCase()));
  }
  return set;
}

/*───────────────────────────────────────────────────────────────────────────*/
async function scanDocs (root, glossDir, known, ignore) {
  const freq = new Map();

  const walk = async dir => {
    for (const d of await fs.readdir(dir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        if (['node_modules', '.vitepress', 'glossary', '.clio'].includes(d.name)) continue;
        await walk(path.join(dir, d.name));
      } else if (d.name.endsWith('.md')) {
        await processFile(path.join(dir, d.name));
      }
    }
  };

  const processFile = async file => {
    let txt = await fs.readFile(file, 'utf8');
    txt = txt.replace(CODE_FENCE, ' ');
    const rel = path.relative(root, file);
    const tokens = txt.split(/\W+/).filter(Boolean);

    for (let w of tokens) {
      w = w.toLowerCase();
      if (w.length < 3 || /\d/.test(w) || known.has(w) || ignore.has(w)) continue;
      const e = freq.get(w) || { count: 0, files: new Set() };
      e.count++; e.files.add(rel);
      freq.set(w, e);
    }
  };

  await walk(root);

  /* candidates */
  const candidates = [...freq.entries()].filter(([,v]) => v.count >= 3 && v.files.size >= 2);

  /* fuzzy cluster */
  const fuse = new Fuse(
    candidates.map(([w]) => ({ word: w })),
    { includeScore: true, threshold: 0.3, keys: ['word'] }
  );

  const clusters = [];
  const seen = new Set();

  for (const [word] of candidates.sort((a,b)=>b[1].count - a[1].count)) {
    if (seen.has(word)) continue;
    const group = fuse.search(word).map(r => r.item.word);
    group.forEach(g => seen.add(g));

    const total = group.reduce((n,x) => n + freq.get(x).count, 0);
    const files = new Set(group.flatMap(x => [...freq.get(x).files]));
    clusters.push({ members: group, total, files });
  }

  clusters.sort((a,b)=>b.total - a.total);
  return { clusters };
}
