//  ── src/commands/search.js ────────────────────────────────────────────────
import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Fuse from 'fuse.js';

import { loadClioConfig } from '../utils/clioConfig.js';

const TOC_MD      = '_gloss_TOC.md';
const ENTRY_REGEX = /```json\s*([\s\S]*?)```/;

/*───────────────────────────────────────────────────────────────────────────*/
export async function searchCommand (query) {
  /* locate project + glossary dir */
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
  const { projectRoot, glossaryDir } = meta;

  try {
    /* prompt for query if missing */
    if (!query) {
      ({ query } = await inquirer.prompt([{
        name: 'query',
        type: 'input',
        message: 'Search term:'
      }]));
    }
    query = query.trim();
    if (!query) {
      console.error(chalk.red('✖  Empty query – aborting.'));
      process.exit(1);
    }

    const records = await loadGlossary(glossaryDir);
    if (!records.length) {
      console.error(chalk.red('✖  No glossary entries found.'));
      process.exit(1);
    }

    const fuse = new Fuse(records, {
      ignoreLocation: true,
      threshold: 0.4,
      keys: [
        { name: 'primary',    weight: 0.6 },
        { name: 'alternates', weight: 0.3 },
        { name: 'definition', weight: 0.1 }
      ]
    });

    const hits = fuse.search(query, { limit: 20 });
    if (!hits.length) {
      console.log(chalk.yellow('No matches.'));
      process.exit(0);
    }

    printResults(hits, projectRoot);
  } catch (err) {
    console.error(chalk.red('✖  Search failed\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* helpers */

async function loadGlossary (dir) {
  let files;
  try { files = await fs.readdir(dir); }
  catch { return []; }

  const mdFiles = files.filter(f => f.endsWith('.md') && f !== TOC_MD);

  const out = [];
  for (const file of mdFiles) {
    const fullPath = path.join(dir, file);
    const text = await fs.readFile(fullPath, 'utf8');
    const m = text.match(ENTRY_REGEX);
    if (!m) continue;

    let data;
    try { data = JSON.parse(m[1]); }
    catch { continue; }

    const altWords = [
      ...data.alternates.map(a => a.singular),
      ...data.alternates.filter(a => a.plural).map(a => a.plural),
      data.plural
    ];

    out.push({
      primary:    data.singular,
      alternates: altWords,
      definition: data.definition,
      mentioned:  data.mentionedOnPages || [],
      file:       fullPath
    });
  }
  return out;
}

function printResults (hits, projectRoot) {
  console.log(chalk.green(
    `Found ${hits.length} match${hits.length === 1 ? '' : 'es'}:\n`
  ));

  const width = Math.max(...hits.map(h => h.item.primary.length));

  hits.forEach((h, i) => {
    const term = h.item.primary.padEnd(width);
    const def  = h.item.definition.split('\n')[0];
    const rel  = path.relative(projectRoot, h.item.file);

    console.log(
      chalk.cyan(`${i + 1}) ${term}  `) +
      chalk.white('– ') +
      chalk.gray(def)
    );
    console.log(chalk.dim('   File: ' + rel));

    if (h.item.mentioned.length) {
      console.log(
        chalk.yellow('   Mentioned on: ') + h.item.mentioned.join(', ')
      );
    }
    console.log();
  });
}
