import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { loadClioConfig } from '../utils/clioConfig.js';

const DEFAULT_GLOSSARY_DIR = 'glossary';
const TOC_MD               = '_gloss_TOC.md';
const TOC_CONTENT          = '# Glossary Table of Contents\n\n';

const DEFAULT_IGNORE = `
a an and are as at be but by for from has have in is it its of on or that the to with was were will this each all used
`.trim().split(/\s+/);

export async function initCommand () {
  const cwd = process.cwd();

  /* abort if we're already inside a project */
  const existing = await loadClioConfig(cwd).catch(() => null);
  if (existing) {
    const msg = existing.projectRoot === cwd
      ? '.clio/ already present here.'
      : `A Clio project exists higher up at "${existing.projectRoot}".`;
    console.error(chalk.red(`✖  ${msg}`));
    process.exit(1);
  }

  try {
    /* 1. create .clio/ */
    const clioDir = path.join(cwd, '.clio');
    await fs.mkdir(clioDir, { recursive: true });
    console.log(chalk.green('✓  Created .clio/'));

    /* 2. write config.json */
    const cfgPath = path.join(clioDir, 'config.json');
    const cfg = {
      schema: 1,
      glossaryDir: DEFAULT_GLOSSARY_DIR,
      ignoreWords: DEFAULT_IGNORE
    };
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log(chalk.green('✓  Created .clio/config.json'));

    /* 3. glossary dir */
    const glossaryDir = path.join(cwd, cfg.glossaryDir);
    await fs.mkdir(glossaryDir, { recursive: true });
    console.log(chalk.green(`✓  Created ${cfg.glossaryDir}/`));

    /* 4. stub TOC */
    await fs.writeFile(path.join(glossaryDir, TOC_MD), TOC_CONTENT, 'utf8');
    console.log(chalk.green(`✓  Created ${path.join(cfg.glossaryDir, TOC_MD)}`));

    console.log(chalk.bold.green('\nProject initialised – happy documenting!'));
  } catch (err) {
    console.error(chalk.red('✖  init failed\n'), err);
    process.exit(1);
  }
}
