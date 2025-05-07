import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { loadClioConfig } from '../utils/clioConfig.js';

/* ------------------------------------------------------------------ */
/* RegExp notes
   • Ignore image links (`![]()`) via negative look‑behind for `!`
   • Ignore absolute / web links (`http`, `https`, `mailto`, etc.)
   • Catch local MD links with optional #hash
*/
const LOCAL_MD_LINK_RE =
  /(?<!\!)\[([^\]]+)]\(\s*(?!https?:\/\/)(?!mailto:)[^)]+?\.md(?:#[^)]+)?\s*\)/gi;

/* ------------------------------------------------------------------ */
export async function delinkCommand () {
  /* locate project root */
  const meta = await loadClioConfig().catch(e => {
    console.error(chalk.red(`✖  ${e.message}`));
    process.exit(1);
  });
  if (!meta) {
    console.error(chalk.red('✖  Not inside a Clio project. Run "clio init" first.'));
    process.exit(1);
  }
  const { projectRoot } = meta;

  let fileCount = 0;
  let linkCount = 0;

  /* recursive walk */
  async function walk (dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['node_modules', '.vitepress', '.clio'].includes(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.md')) {
        await processFile(path.join(dir, entry.name));
      }
    }
  }

  /* strip links in one file */
  async function processFile (filePath) {
    let txt = await fs.readFile(filePath, 'utf8');
    const before = txt;

    /* replace each local‑md link with its label */
    txt = txt.replace(LOCAL_MD_LINK_RE, (_, label) => {
      linkCount += 1;
      return label;
    });

    if (txt !== before) {
      await fs.writeFile(filePath, txt, 'utf8');
      fileCount += 1;
    }
  }

  await walk(projectRoot);

  console.log(
    chalk.green(
      `✓  Removed ${linkCount} local link${linkCount !== 1 ? 's' : ''} `
      + `across ${fileCount} file${fileCount !== 1 ? 's' : ''}.`
    )
  );
}
