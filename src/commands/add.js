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
  const { caseSensitive } = await inquirer.prompt([{
    name: 'caseSensitive',
    type: 'input',
    message: 'Is the term case‑sensitive? (Y/n) [default: n]',
    filter: i => (i ?? '').trim().toLowerCase()
  }]);

  const cs = ['y', 'yes', 't', 'true'].includes(caseSensitive);

  const { singular } = await inquirer.prompt([{
    name: 'singular',
    type: 'input',
    message: 'Singular form of the term:',
    validate: i => i.trim().length ? true : 'Required'
  }]);

  const { plural } = await inquirer.prompt([{
    name: 'plural',
    type: 'input',
    message: 'Plural form of the term:',
    validate: i => i.trim().length ? true : 'Required'
  }]);

  const { altSingularCsv } = await inquirer.prompt([{
    name: 'altSingularCsv',
    type: 'input',
    message: 'Alternate singular words/phrases (comma separated, leave blank if none):'
  }]);

  const altSingulars = altSingularCsv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const alternates = [];
  for (const alt of altSingulars) {
    const { altPlural } = await inquirer.prompt([{
      name: 'altPlural',
      type: 'input',
      message: `Plural of "${alt}" (leave blank if none):`
    }]);
    if (altPlural.trim()) {
      alternates.push({ singular: alt, plural: altPlural.trim() });
    } else {
      alternates.push({ singular: alt });
    }
  }

  /* definition prompt with fallback */
  let definition = '';
  try {
    ({ definition } = await inquirer.prompt([{
      name: 'definition',
      type: 'editor',
      message: 'Definition (opens $EDITOR; save & close when done):'
    }]));
  } catch (e) {
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
    singular: singular.trim(),
    plural: plural.trim(),
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

  const mdContent =
    `# ${data.singular}
  
  ${data.definition}
  
  ${ENTRY_START}
  
  \`\`\`glossary-entry
  ${JSON.stringify({ ...data, mentionedOnPages: [] }, null, 2)}
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

  const lines = tocText.trimEnd().split('\n');
  const header = lines.filter(l => !l.startsWith('- ['));
  let entries = lines.filter(l => l.startsWith('- ['));

  const newEntry = `- [${data.singular}](./${slug}.md)`;

  entries = entries.filter(l => l.toLowerCase() !== newEntry.toLowerCase());
  entries.push(newEntry);

  entries.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  const rebuilt =
    header.join('\n').trimEnd() + '\n\n' +
    entries.join('\n') + '\n';

  await fs.writeFile(tocPath, rebuilt, 'utf8');
}
