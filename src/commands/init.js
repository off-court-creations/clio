import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { loadClioConfig } from '../utils/clioConfig.js';
import { DEFAULT_IGNORE } from '../utils/defaultIgnore.js';

const DEFAULT_GLOSSARY_DIR = 'glossary';
const IGNORE_FILE          = 'ignore.txt';
const TOC_MD               = '_gloss_TOC.md';
const TOC_CONTENT          = '# Glossary Table of Contents\n\n';

/*───────────────────────────────────────────────────────────────────────────*/
export async function initCommand () {
  const cwd = process.cwd();

  /* abort if inside another Clio project */
  const enclosing = await loadClioConfig(cwd).catch(() => null);
  if (enclosing) {
    const msg = enclosing.projectRoot === cwd
      ? '.clio/ already present here.'
      : `A Clio project exists higher up at “${enclosing.projectRoot}”.`;
    console.error(chalk.red(`✖  ${msg}`));
    process.exit(1);
  }

  try {
    /* 1. .clio directory ------------------------------------------------- */
    const clioDir = path.join(cwd, '.clio');
    await fs.mkdir(clioDir, { recursive: true });
    console.log(chalk.green('✓  Created .clio/'));

    /* 2. ignore.txt with default words ---------------------------------- */
    const ignorePath = path.join(clioDir, IGNORE_FILE);
    await fs.writeFile(ignorePath, DEFAULT_IGNORE.join('\n') + '\n', 'utf8');
    console.log(chalk.green(`✓  Created .clio/${IGNORE_FILE}`));

    /* 3. config.json ----------------------------------------------------- */
    const cfgPath = path.join(clioDir, 'config.json');
    const cfg = {
      schema     : 1,
      glossaryDir: DEFAULT_GLOSSARY_DIR,
      ignoreFile : IGNORE_FILE
    };
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log(chalk.green('✓  Created .clio/config.json'));

    /* 4. re‑load config to respect custom paths ------------------------- */
    const { glossaryDir: glossaryAbs } = await loadClioConfig(cwd);
    const glossaryRel = path.relative(cwd, glossaryAbs) || '.';

    /* 5. glossary folder & stub TOC ------------------------------------- */
    await fs.mkdir(glossaryAbs, { recursive: true });
    console.log(chalk.green(`✓  Created ${glossaryRel}/`));

    await fs.writeFile(path.join(glossaryAbs, TOC_MD), TOC_CONTENT, 'utf8');
    console.log(chalk.green(`✓  Created ${path.join(glossaryRel, TOC_MD)}`));

    console.log(chalk.bold.green('\nProject initialised – happy documenting!'));
  } catch (err) {
    console.error(chalk.red('✖  init failed\n'), err);
    process.exit(1);
  }
}
