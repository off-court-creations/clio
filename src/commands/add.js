//  ── src/commands/add.js ────────────────────────────────────────────────────
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import slugify from 'slugify';

/*───────────────────────────────────────────────────────────────────────────*/
/* 0. Guarantee an editor for inquirer's `type:"editor"` prompt              */
if (!process.env.VISUAL && !process.env.EDITOR) {
  process.env.EDITOR = process.platform === 'win32' ? 'notepad' : 'nano';
}

/*───────────────────────────────────────────────────────────────────────────*/

const GLOSSARY_DIR = 'glossary';
const TOC_MD = '_gloss_TOC.md';

const TOC_HEADER = '# Glossary Table of Contents\n\n';
const ENTRY_START = '<!-- glossary-entry:start -->';
const ENTRY_END = '<!-- glossary-entry:end -->';

/*───────────────────────────────────────────────────────────────────────────*/
/* helpers */
const defaultPlural      = word => `${word}s`;                 // dog → dogs
const defaultPossessive  = word => (/s$/i.test(word) ? `${word}'` : `${word}'s`);
const isYes              = str  => ['y', 'yes', 't', 'true'].includes(str);

/*───────────────────────────────────────────────────────────────────────────*/

export async function addCommand() {
  try {
    const projectRoot = process.cwd();
    const glossaryDir = path.join(projectRoot, GLOSSARY_DIR);

    await ensureStructure(glossaryDir);

    const data = await promptForTerm();
    await writeTermFile(glossaryDir, data);
    await updateTOC(glossaryDir, data);

    console.log(chalk.green('✓  Term added & glossary/TOC updated.'));
  } catch (err) {
    console.error(chalk.red('✖  Failed to add term\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 1. Ensure folder & _gloss_TOC.md exist */
async function ensureStructure(dir) {
  try { await fs.access(dir); }
  catch { await fs.mkdir(dir, { recursive: true }); }

  const tocPath = path.join(dir, TOC_MD);
  try { await fs.access(tocPath); }
  catch { await fs.writeFile(tocPath, TOC_HEADER, 'utf8'); }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 2. Interactive prompts */
async function promptForTerm() {
  /* — main case‑sensitivity — */
  const { caseSensitive } = await inquirer.prompt([{
    name: 'caseSensitive',
    type: 'input',
    message: 'Is the term case‑sensitive? (Y/n) [default: n]',
    filter: i => (i ?? '').trim().toLowerCase()
  }]);
  const cs = isYes(caseSensitive);

  /* — singular + singular possessive — */
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

  /* — plural (+possessive) — */
  const pluralDefault = defaultPlural(singularTrimmed);
  const { pluralRaw } = await inquirer.prompt([{
    name: 'pluralRaw',
    type: 'input',
    message: `Plural of "${singularTrimmed}" (Enter → "${pluralDefault}", "-" for none, or custom):`
  }]);
  let pluralTrimmed;
  const pr = pluralRaw.trim();
  if (!pr) pluralTrimmed = pluralDefault;
  else if (pr !== '-') pluralTrimmed = pr; // '-' means no plural

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

  /* — alternates — */
  const { altSingularCsv } = await inquirer.prompt([{
    name: 'altSingularCsv',
    type: 'input',
    message: 'Alternate singular words/phrases (comma separated, leave blank if none):'
  }]);

  const alternates = [];
  const altSingulars = altSingularCsv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const alt of altSingulars) {
    /* alt case‑sensitivity (default = same as main) */
    const { altCaseRaw } = await inquirer.prompt([{
      name: 'altCaseRaw',
      type: 'input',
      message: `Is "${alt}" case‑sensitive? (Y/n) [default: ${cs ? 'y' : 'n'}]`,
      filter: i => (i ?? '').trim().toLowerCase()
    }]);
    const altCs = altCaseRaw ? isYes(altCaseRaw) : cs;

    /* alt plural */
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

    /* alt singular possessive */
    const altSingPossDefault = defaultPossessive(alt);
    const { altSingPossRaw } = await inquirer.prompt([{
      name: 'altSingPossRaw',
      type: 'input',
      message: `Possessive of "${alt}" (Enter → "${altSingPossDefault}", "-" for none, or custom):`
    }]);
    const aspRaw = altSingPossRaw.trim();
    const altSingPossessive =
      !aspRaw ? altSingPossDefault : (aspRaw === '-' ? undefined : aspRaw);

    /* alt plural possessive */
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
      singular: alt,
      caseSensitive: altCs,
      ...(altSingPossessive ? { singularPossessive: altSingPossessive } : {}),
      ...(altPluralTrimmed ? { plural: altPluralTrimmed } : {}),
      ...(altPluralPossessive ? { pluralPossessive: altPluralPossessive } : {})
    });
  }

  /* — definition (with editor fallback) — */
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

  /* — usage — */
  const { usage } = await inquirer.prompt([{
    name: 'usage',
    type: 'input',
    message: 'Use it in a sentence:'
  }]);

  /* — build result — */
  return {
    caseSensitive: cs,
    singular: singularTrimmed,
    ...(singularPossessive ? { singularPossessive } : {}),
    ...(pluralTrimmed ? { plural: pluralTrimmed } : {}),
    ...(pluralPossessive ? { pluralPossessive } : {}),
    alternates,
    definition: definition.trim(),
    usage: usage.trim()
  };
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 3. Create / overwrite the single‑file glossary entry */
async function writeTermFile(glossaryDir, data) {
  const slug = slugify(data.singular, { lower: true, strict: true });
  const mdPath = path.join(glossaryDir, `${slug}.md`);

  const meta = {
    ...data,
    mentionedOnPages:    [],
    mentionedByEntries:  []
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
/* 4. Update _gloss_TOC.md */
async function updateTOC(glossaryDir, data) {
  const slug = slugify(data.singular, { lower: true, strict: true });
  const tocPath = path.join(glossaryDir, TOC_MD);
  const tocText = await fs.readFile(tocPath, 'utf8');

  const lines   = tocText.trimEnd().split('\n');
  const header  = lines.filter(l => !l.startsWith('- ['));
  let   entries = lines.filter(l =>  l.startsWith('- ['));

  const newEntry = `- [${data.singular}](./${slug}.md)`;

  entries = entries.filter(l => l.toLowerCase() !== newEntry.toLowerCase());
  entries.push(newEntry);

  entries.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  const rebuilt =
    header.join('\n').trimEnd() + '\n\n' +
    entries.join('\n') + '\n';

  await fs.writeFile(tocPath, rebuilt, 'utf8');
}
