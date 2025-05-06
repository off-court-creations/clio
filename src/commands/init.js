//  ── src/commands/init.js ──────────────────────────────────────────────────
import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { loadClioConfig } from '../utils/clioConfig.js';

const DEFAULT_GLOSSARY_DIR = 'glossary';
const TOC_MD               = '_gloss_TOC.md';
const TOC_CONTENT          = '# Glossary Table of Contents\n\n';

export async function initCommand () {
  const cwd = process.cwd();

  /*───────────────────────────────────────────────────────────────────────*
   * 0. safety: abort if a project already envelopes this cwd             *
   *───────────────────────────────────────────────────────────────────────*/
  const existing = await loadClioConfig(cwd).catch(() => null);
  if (existing) {
    /* already at (or beneath) a project root */
    if (existing.projectRoot === cwd) {
      console.error(chalk.red('✖  This directory is already a Clio project (.clio/ present).'));
    } else {
      console.error(chalk.red(
        `✖  A Clio project already exists at "${existing.projectRoot}".\n` +
        '    Initialise new projects outside the existing one.'
      ));
    }
    process.exit(1);
  }

  try {
    const clioDir = path.join(cwd, '.clio');
    const cfgPath = path.join(clioDir, 'config.json');

    /* 1. create .clio/ */
    await fs.mkdir(clioDir, { recursive: true });
    console.log(chalk.green('✓  Created .clio/'));

    /* 2. write config.json */
    const cfg = { schema: 1, glossaryDir: DEFAULT_GLOSSARY_DIR };
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log(chalk.green('✓  Created .clio/config.json'));

    /* 3. glossary folder */
    const glossaryDir = path.join(cwd, cfg.glossaryDir);
    await fs.mkdir(glossaryDir, { recursive: true });
    console.log(chalk.green(`✓  Created ${cfg.glossaryDir}/`));

    /* 4. stub TOC */
    const tocPath = path.join(glossaryDir, TOC_MD);
    await fs.writeFile(tocPath, TOC_CONTENT, 'utf8');
    console.log(chalk.green(`✓  Created ${path.join(cfg.glossaryDir, TOC_MD)}`));

    console.log(chalk.bold.green('\nProject initialised – happy documenting!'));
  } catch (err) {
    console.error(chalk.red('✖  init failed\n'), err);
    process.exit(1);
  }
}
