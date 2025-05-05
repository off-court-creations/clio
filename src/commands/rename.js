//  ── src/commands/rename.js ────────────────────────────────────────────────
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import slugify from 'slugify';

const GLOSSARY_DIR = 'glossary';
const TOC_MD = '_gloss_TOC.md';
const ENTRY_REGEX = /```glossary-entry\s*([\s\S]*?)```/;
const GLOSS_LINK_RE = /\[([^\]]+)]\([^)]*?glossary\/[^)]+\)/gi;

/*───────────────────────────────────────────────────────────────────────────*/

export async function renameCommand() {
    try {
        const projectRoot = process.cwd();
        const glossaryDir = path.join(projectRoot, GLOSSARY_DIR);

        /* 1. pick an existing entry via a‑b‑c list */
        const entries = await listGlossaryEntries(glossaryDir);
        const choice = await promptChoice(entries);
        const { file: oldFile, data } = entries[choice];

        /* 2. gather new singular / plural / alternates */
        const {
            newSingular,
            newPlural,
            newAlts,
            newAltPlurals
        } = await promptNewValues(data.singular);

        const oldSingular = data.singular;
        const oldPlural = data.plural;
        const oldSlug = slugify(oldSingular, { lower: true, strict: true });
        const newSlug = slugify(newSingular, { lower: true, strict: true });

        /* 3. rename glossary file & JSON */
        await renameGlossaryFile(glossaryDir, oldFile, {
            oldSingular, oldPlural, oldSlug,
            newSingular, newPlural, newSlug,
            newAlts, newAltPlurals,
            data
        });

        /* 4. patch _gloss_TOC.md */
        await patchTOC(glossaryDir, { oldSingular, newSingular, oldSlug, newSlug });

        /* 5. build variant map (old → new) */
        const variantMap = buildVariantMap(data, {
            newSingular, newPlural,
            newAlts, newAltPlurals
        });

        /* 6. sweep every .md (incl. glossary) and replace */
        await sweepDocs(projectRoot, glossaryDir, variantMap, { oldSlug, newSlug });

        console.log(chalk.green('✓  Rename complete.'));
    } catch (err) {
        console.error(chalk.red('✖  Rename failed\n'), err);
        process.exit(1);
    }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* Interactive helpers */

async function listGlossaryEntries(dir) {
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md') && f !== TOC_MD);

    const out = [];
    for (const f of files) {
        const txt = await fs.readFile(path.join(dir, f), 'utf8');
        const m = txt.match(ENTRY_REGEX);
        if (!m) continue;
        const obj = JSON.parse(m[1]);
        out.push({ file: f, data: obj });
    }
    out.sort((a, b) => a.data.singular.localeCompare(b.data.singular, 'en', { sensitivity: 'base' }));
    return out;
}

function idxToLabel(i) {
    let s = ''; i++;
    while (i) { i--; s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26); }
    return s;
}

async function promptChoice(entries) {
    const choices = entries.map((e, i) => ({
        name: `${idxToLabel(i)}) ${e.data.singular}`,
        value: i
    }));

    const { pick } = await inquirer.prompt([{
        name: 'pick',
        type: 'list',
        message: 'Select a term to rename:',
        choices,
        pageSize: 20
    }]);

    return pick;
}

async function promptNewValues(oldSingular) {
    const { newSingular } = await inquirer.prompt([{
        name: 'newSingular',
        type: 'input',
        message: `New singular for "${oldSingular}":`,
        validate: i => i.trim() ? true : 'Required'
    }]);

    const { newPlural } = await inquirer.prompt([{
        name: 'newPlural',
        type: 'input',
        message: `Plural of "${newSingular}":`,
        default: newSingular + 's'
    }]);

    const { altCsv } = await inquirer.prompt([{
        name: 'altCsv',
        type: 'input',
        message: 'New singular alternates (comma‑separated, blank for none):'
    }]);

    const alts = altCsv.split(',').map(s => s.trim()).filter(Boolean);

    const altPlurals = [];
    for (const alt of alts) {
        const { p } = await inquirer.prompt([{
            name: 'p',
            type: 'input',
            message: `Plural of "${alt}" (enter to skip):`
        }]);
        altPlurals.push(p.trim() || null);
    }

    return { newSingular, newPlural, newAlts: alts, newAltPlurals: altPlurals };
}

/*───────────────────────────────────────────────────────────────────────────*/
/* glossary file & TOC patching */

async function renameGlossaryFile(dir, oldFile, info) {
    const oldPath = path.join(dir, oldFile);
    let txt = await fs.readFile(oldPath, 'utf8');

    /* rewrite JSON */
    txt = txt.replace(ENTRY_REGEX, (_, json) => {
        const obj = JSON.parse(json);
        obj.singular = info.newSingular;
        obj.plural = info.newPlural;
        obj.alternates = info.newAlts.map((sing, i) => ({
            singular: sing,
            plural: info.newAltPlurals[i] || undefined
        }));
        // retain old singular/plural as alternates for legacy links
        obj.alternates.push({ singular: info.oldSingular, plural: info.oldPlural });
        return '```glossary-entry\n' + JSON.stringify(obj, null, 2) + '\n```';
    });

    /* patch title line */
    txt = txt.replace(new RegExp(`^#\\s+${escapeReg(info.oldSingular)}\\b`), `# ${info.newSingular}`);

    await fs.writeFile(oldPath, txt, 'utf8');

    if (info.oldSlug !== info.newSlug) {
        await fs.rename(oldPath, path.join(dir, `${info.newSlug}.md`));
    }
}

async function patchTOC(dir, { oldSingular, newSingular, oldSlug, newSlug }) {
    const tocPath = path.join(dir, TOC_MD);
    let txt = await fs.readFile(tocPath, 'utf8');
    const re = new RegExp(`- \\[${escapeReg(oldSingular)}]\\([^\\)]*${escapeReg(oldSlug)}\\.md\\)`);
    txt = txt.replace(re, `- [${newSingular}](./${newSlug}.md)`);
    await fs.writeFile(tocPath, txt, 'utf8');
}

/*───────────────────────────────────────────────────────────────────────────*/
/* Build map old‑form → new‑form (singular + plural + alternates) */

function buildVariantMap(oldData, { newSingular, newPlural, newAlts, newAltPlurals }) {
    const map = new Map();

    map.set(oldData.singular.toLowerCase(), newSingular);
    map.set(oldData.plural.toLowerCase(), newPlural);

    oldData.alternates.forEach((oldAlt, i) => {
        const newAltSing = newAlts[i] ?? oldAlt.singular;   // fallback to same
        const newAltPlur = newAltPlurals[i] ?? oldAlt.plural ?? newAltSing + 's';
        if (oldAlt.singular) map.set(oldAlt.singular.toLowerCase(), newAltSing);
        if (oldAlt.plural) map.set(oldAlt.plural.toLowerCase(), newAltPlur);
    });

    return map;
}

/*───────────────────────────────────────────────────────────────────────────*/
/* sweep every .md (including glossary) */

async function sweepDocs(root, glossaryDir, variantMap, { oldSlug, newSlug }) {
    const walk = async dir => {
        for (const d of await fs.readdir(dir, { withFileTypes: true })) {
            if (d.isDirectory() && d.name === 'node_modules') continue;
            const p = path.join(dir, d.name);
            if (d.isDirectory()) { await walk(p); continue; }

            if (d.name.endsWith('.md')) await processFile(p);
        }
    };

    const processFile = async file => {
        let txt = await fs.readFile(file, 'utf8');

        /* replace link targets & labels */
        txt = txt.replace(GLOSS_LINK_RE, (full, label, url, offset) => {
            if (typeof url !== 'string') return full;                 // safety guard
            let newUrl = url;
            if (url.includes(`/${oldSlug}.md`)) {
                const base = path.dirname(file);
                const rel = path.relative(base,
                    path.join(glossaryDir, `${newSlug}.md`));
                newUrl = rel.startsWith('.') ? rel : './' + rel;
            }
            const newLabel = replaceWord(label, variantMap);
            return `[${newLabel}](${newUrl})`;
        });

        /* replace bare words in prose */
        const [head, tail] = splitAtEntry(txt);
        const patchedHead = head.replace(/\b([\w\-']+)\b/gi, w => {
            const repl = variantMap.get(w.toLowerCase());
            return repl ? matchCase(w, repl) : w;
        });

        await fs.writeFile(file, patchedHead + tail, 'utf8');
    };

    await walk(root);
}

/*───────────────────────────────────────────────────────────────────────────*/
/* small utils */

function replaceWord(word, map) {
    const repl = map.get(word.toLowerCase());
    return repl ? matchCase(word, repl) : word;
}

function splitAtEntry(txt) {
    const i = txt.indexOf('```glossary-entry');
    return i === -1 ? [txt, ''] : [txt.slice(0, i), txt.slice(i)];
}

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function matchCase(src, dest) {
    return /^[A-Z]/.test(src) ? dest[0].toUpperCase() + dest.slice(1) : dest;
}
