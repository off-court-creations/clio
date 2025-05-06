//  ── src/commands/add.js ────────────────────────────────────────────────────
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import slugify from 'slugify';

import { loadClioConfig } from '../utils/clioConfig.js';

/*───────────────────────────────────────────────────────────────────────────*/
/* guarantee an editor for `type:"editor"` prompts                           */
if (!process.env.VISUAL && !process.env.EDITOR) {
  process.env.EDITOR = process.platform === 'win32' ? 'notepad' : 'nano';
}

/*───────────────────────────────────────────────────────────────────────────*/

const TOC_MD      = '_gloss_TOC.md';
const TOC_HEADER  = '# Glossary Table of Contents\n\n';
const ENTRY_START = '<!-- glossary-entry:start -->';
const ENTRY_END   = '<!-- glossary-entry:end -->';

/* helpers */
const defaultPlural      = w => `${w}s`;
const defaultPossessive  = w => (/s$/i.test(w) ? `${w}'` : `${w}'s`);
const isYes              = s => ['y','yes','t','true'].includes(s);

/*───────────────────────────────────────────────────────────────────────────*/

export async function addCommand () {
  /* locate project + config */
  let meta;
  try { meta = await loadClioConfig(); }
  catch (err) {
    console.error(chalk.red(`✖  ${err.message}`));
    process.exit(1);
  }
  if (!meta) {
    console.error('✖  Not inside a Clio project. Run "clio init" first.');
    process.exit(1);
  }
  const { glossaryDir } = meta;

  try {
    await ensureStructure(glossaryDir);

    const data = await promptForTerm();
    await writeTermFile(glossaryDir, data);
    await rebuildTOC(glossaryDir);

    console.log(chalk.green('✓  Term added & glossary/TOC updated.'));
  } catch (err) {
    console.error(chalk.red('✖  Failed to add term\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 1. ensure glossary dir + TOC exists                                       */
async function ensureStructure (dir) {
  try { await fs.access(dir); }
  catch { await fs.mkdir(dir, { recursive: true }); }

  const tocPath = path.join(dir, TOC_MD);
  try { await fs.access(tocPath); }
  catch { await fs.writeFile(tocPath, TOC_HEADER, 'utf8'); }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 2. interactive prompts (unchanged logic)                                  */
async function promptForTerm () {
  const { caseSensitive } = await inquirer.prompt([{
    name: 'caseSensitive',
    type: 'input',
    message: 'Is the term case‑sensitive? (Y/n) [default: n]',
    filter: i => (i ?? '').trim().toLowerCase()
  }]);
  const cs = isYes(caseSensitive);

  const { singular } = await inquirer.prompt([{
    name: 'singular',
    type: 'input',
    message: 'Singular form of the term:',
    validate: i => i.trim().length ? true : 'Required'
  }]);
  const singularTrimmed = singular.trim();

  const singularPossDefault = defaultPossessive(singularTrimmed);
  const { singularPossessiveRaw } = await inquirer.prompt([{
    name: 'singularPossessiveRaw',
    type: 'input',
    message: `Possessive of "${singularTrimmed}" (Enter → "${singularPossDefault}", "-" for none, or custom):`
  }]);
  const spRaw = singularPossessiveRaw.trim();
  const singularPossessive =
    !spRaw ? singularPossDefault : (spRaw === '-' ? undefined : spRaw);

  const pluralDefault = defaultPlural(singularTrimmed);
  const { pluralRaw } = await inquirer.prompt([{
    name: 'pluralRaw',
    type: 'input',
    message: `Plural of "${singularTrimmed}" (Enter → "${pluralDefault}", "-" for none, or custom):`
  }]);
  let pluralTrimmed;
  const pr = pluralRaw.trim();
  if (!pr) pluralTrimmed = pluralDefault;
  else if (pr !== '-') pluralTrimmed = pr;

  let pluralPossessive;
  if (pluralTrimmed) {
    const pluralPossDefault = defaultPossessive(pluralTrimmed);
    const { pluralPossessiveRaw } = await inquirer.prompt([{
      name: 'pluralPossessiveRaw',
      type: 'input',
      message: `Possessive of "${pluralTrimmed}" (Enter → "${pluralPossDefault}", "-" for none, or custom):`
    }]);
    const ppRaw = pluralPossessiveRaw.trim();
    if (!ppRaw) pluralPossessive = pluralPossDefault;
    else if (ppRaw !== '-') pluralPossessive = ppRaw;
  }

  const { altSingularCsv } = await inquirer.prompt([{
    name: 'altSingularCsv',
    type: 'input',
    message: 'Alternate singular words/phrases (comma separated, leave blank if none):'
  }]);

  const alternates = [];
  const altSingulars = altSingularCsv.split(',').map(s=>s.trim()).filter(Boolean);

  for (const alt of altSingulars) {
    const { altCaseRaw } = await inquirer.prompt([{
      name: 'altCaseRaw',
      type: 'input',
      message: `Is "${alt}" case‑sensitive? (Y/n) [default: ${cs ? 'y' : 'n'}]`,
      filter: i => (i ?? '').trim().toLowerCase()
    }]);
    const altCs = altCaseRaw ? isYes(altCaseRaw) : cs;

    const altPluralDefault = defaultPlural(alt);
    const { altPluralRaw } = await inquirer.prompt([{
      name: 'altPluralRaw',
      type: 'input',
      message: `Plural of "${alt}" (Enter → "${altPluralDefault}", "-" for none, or custom):`
    }]);
    let altPluralTrimmed;
    const apr = altPluralRaw.trim();
    if (!apr) altPluralTrimmed = altPluralDefault;
    else if (apr !== '-') altPluralTrimmed = apr;

    const altSingPossDefault = defaultPossessive(alt);
    const { altSingPossRaw } = await inquirer.prompt([{
      name: 'altSingPossRaw',
      type: 'input',
      message: `Possessive of "${alt}" (Enter → "${altSingPossDefault}", "-" for none, or custom):`
    }]);
    const aspRaw = altSingPossRaw.trim();
    const altSingPossessive =
      !aspRaw ? altSingPossDefault : (aspRaw === '-' ? undefined : aspRaw);

    let altPluralPossessive;
    if (altPluralTrimmed) {
      const altPluralPossDefault = defaultPossessive(altPluralTrimmed);
      const { altPluralPossRaw } = await inquirer.prompt([{
        name: 'altPluralPossRaw',
        type: 'input',
        message: `Possessive of "${altPluralTrimmed}" (Enter → "${altPluralPossDefault}", "-" for none, or custom):`
      }]);
      const appRaw = altPluralPossRaw.trim();
      if (!appRaw) altPluralPossessive = altPluralPossDefault;
      else if (appRaw !== '-') altPluralPossessive = appRaw;
    }

    alternates.push({
      singular:      alt,
      caseSensitive: altCs,
      ...(altSingPossessive ? { singularPossessive: altSingPossessive } : {}),
      ...(altPluralTrimmed   ? { plural: altPluralTrimmed }             : {}),
      ...(altPluralPossessive? { pluralPossessive: altPluralPossessive } : {})
    });
  }

  let definition = '';
  try {
    ({ definition } = await inquirer.prompt([{
      name: 'definition',
      type: 'editor',
      message: 'Definition (opens $EDITOR; save & close when done):'
    }]));
  } catch {
    console.warn('⚠️  Could not launch external editor – falling back to inline input.');
    ({ definition } = await inquirer.prompt([{
      name: 'definition',
      type: 'input',
      message: 'Definition (single line, required):',
      validate: i => i.trim().length ? true : 'Required'
    }]));
  }

  const { usage } = await inquirer.prompt([{
    name: 'usage',
    type: 'input',
    message: 'Use it in a sentence:'
  }]);

  return {
    caseSensitive: cs,
    singular: singularTrimmed,
    ...(singularPossessive ? { singularPossessive } : {}),
    ...(pluralTrimmed      ? { plural: pluralTrimmed } : {}),
    ...(pluralPossessive   ? { pluralPossessive } : {}),
    alternates,
    definition: definition.trim(),
    usage: usage.trim()
  };
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 3. create / overwrite term file                                           */
async function writeTermFile (glossaryDir, data) {
  const slug = slugify(data.singular, { lower: true, strict: true });
  const mdPath = path.join(glossaryDir, `${slug}.md`);

  const meta = {
    ...data,
    mentionedOnPages:   [],
    mentionedByEntries: []
  };

  const mdContent =
`# ${data.singular}

${data.definition}

${data.usage}

${ENTRY_START}

\`\`\`json
${JSON.stringify(meta, null, 2)}
\`\`\`
${ENTRY_END}
`;

  await fs.writeFile(mdPath, mdContent.trimEnd() + '\n', 'utf8');
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 4. rebuild TOC                                                           */
async function rebuildTOC (glossaryDir) {
  const tocPath = path.join(glossaryDir, TOC_MD);

  const files = (await fs.readdir(glossaryDir))
    .filter(f => f !== TOC_MD && path.extname(f) === '.md');

  const entries = [];
  for (const file of files) {
    const firstLine = (await fs.readFile(path.join(glossaryDir, file), 'utf8'))
      .split('\n')[0].trim();
    const title = firstLine.startsWith('#')
      ? firstLine.replace(/^#+\s*/, '')
      : path.basename(file, '.md');
    entries.push({ title, file });
  }

  entries.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));

  const tocBody = entries.map(e => `- [${e.title}](./${e.file})`).join('\n');
  await fs.writeFile(tocPath, TOC_HEADER + tocBody + '\n', 'utf8');
}
