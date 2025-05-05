//  ── src/commands/gloss.js ─────────────────────────────────────────────────
import fs   from 'node:fs/promises';
import path from 'node:path';
import chalk   from 'chalk';
import slugify from 'slugify';

const GLOSSARY_DIR = 'glossary';
const TOC_MD       = '_gloss_TOC.md';

const ENTRY_REGEX  = /```glossary-entry\s*([\s\S]*?)```/;

// match *any* markdown link whose target contains "/glossary/"
const GLOSSARY_LINK_RE = /\[([^\]]+)]\([^)]*?glossary\/[^)]*?\)/gi;

/*───────────────────────────────────────────────────────────────────────────*/

export async function glossCommand () {
  try {
    const projectRoot = process.cwd();
    const glossaryDir = path.join(projectRoot, GLOSSARY_DIR);

    const { metaMap, termPages } = await buildMetaMaps(glossaryDir);
    await relinkGlossaryFiles(glossaryDir, metaMap);
    await relinkContentFiles(projectRoot, glossaryDir, metaMap, termPages);
    await rebuildMentionedOn(glossaryDir, termPages);

    console.log(chalk.green('✓  Glossary linking complete.'));
  } catch (err) {
    console.error(chalk.red('✖  gloss failed\n'), err);
    process.exit(1);
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 1 + 2 — create lookup maps */
async function buildMetaMaps (glossaryDir) {
  const files = (await fs.readdir(glossaryDir))
    .filter(f => f.endsWith('.md') && f !== TOC_MD);

  const metaMap   = new Map();   // every spelling → main singular
  const termPages = new Map();   // main singular   → Set<pages>

  for (const file of files) {
    const text = await fs.readFile(path.join(glossaryDir, file), 'utf8');
    const m = text.match(ENTRY_REGEX);
    if (!m) continue;
    const data = JSON.parse(m[1]);

    termPages.set(data.singular, new Set());

    [
      data.singular,
      data.plural,
      ...data.alternates.map(a => a.singular),
      ...data.alternates.filter(a => a.plural).map(a => a.plural)
    ]
      .filter(Boolean)
      .forEach(v => metaMap.set(v.toLowerCase(), data.singular));
  }
  return { metaMap, termPages };
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 3 — relink glossary pages (skip self‑links) */
async function relinkGlossaryFiles (glossaryDir, metaMap) {
  const files = (await fs.readdir(glossaryDir))
    .filter(f => f.endsWith('.md') && f !== TOC_MD);

  for (const file of files) {
    const full = path.join(glossaryDir, file);
    let text = await fs.readFile(full, 'utf8');

    text = text.replace(GLOSSARY_LINK_RE, '$1');      // unlink all old links
    text = stripSection(text, 'Mentioned on pages');  // drop old section

    const [head, tail] = splitAtEntry(text);
    const selfSlug = path.basename(file, '.md');
    const linked   = new Set();

    const newHead = head.replace(/\b([\w\-']+)\b/gi, raw => {
      const main = metaMap.get(raw.toLowerCase());
      if (!main) return raw;
      if (slugify(main,{lower:true,strict:true}) === selfSlug) return raw;
      if (linked.has(main)) return raw;

      linked.add(main);
      return `[${raw}](./${slugify(main,{lower:true,strict:true})}.md)`;
    });

    await fs.writeFile(full, newHead + tail, 'utf8');
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 4 — relink regular docs & populate termPages */
async function relinkContentFiles (root, glossaryDir, metaMap, termPages) {
  const walk = async dir => {
    for (const d of await fs.readdir(dir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        if (['node_modules', '.vitepress', GLOSSARY_DIR].includes(d.name)) continue;
        await walk(path.join(dir, d.name));
      } else if (d.name.endsWith('.md')) {
        await processDoc(path.join(dir, d.name));
      }
    }
  };

  const processDoc = async file => {
    let txt = await fs.readFile(file, 'utf8');
    txt = txt.replace(GLOSSARY_LINK_RE, '$1');
    txt = stripSection(txt, 'Glossary Terms Mentioned');

    const linked = new Map();                 // main → first display form
    const [head, tail] = splitAtEntry(txt);
    const baseDir = path.dirname(file);

    const newHead = head.replace(/\b([\w\-']+)\b/gi, raw => {
      const main = metaMap.get(raw.toLowerCase());
      if (!main || linked.has(main)) return raw;

      linked.set(main, raw);
      termPages.get(main)?.add(path.relative(glossaryDir, file));

      const rel = path.relative(baseDir,
                    path.join(glossaryDir, `${slugify(main,{lower:true,strict:true})}.md`));
      return `[${raw}](${rel.startsWith('.') ? rel : './'+rel})`;
    });

    if (!linked.size) {
      await fs.writeFile(file, newHead + tail, 'utf8');
      return;
    }

    const list = [...linked.entries()]
      .sort((a,b)=>a[0].localeCompare(b[0],'en',{sensitivity:'base'}))
      .map(([main, disp]) => {
        const rel = path.relative(baseDir,
          path.join(glossaryDir, `${slugify(main,{lower:true,strict:true})}.md`));
        const extra = disp === main ? '' : ` (${disp})`;
        return `- [${main}](${rel.startsWith('.') ? rel : './'+rel})${extra}`;
      })
      .join('\n');

    const rebuilt = newHead.trimEnd() +
      `\n\n## Glossary Terms Mentioned\n\n${list}\n` + tail;

    await fs.writeFile(file, rebuilt, 'utf8');
  };

  await walk(root);
}

/*───────────────────────────────────────────────────────────────────────────*/
/* 5 — sync mentionedOnPages JSON & pretty list */
async function rebuildMentionedOn (glossaryDir, termPages) {
  for (const [main, pages] of termPages) {
    const slug = slugify(main,{lower:true,strict:true});
    const file = path.join(glossaryDir, `${slug}.md`);
    let txt = await fs.readFile(file, 'utf8');

    /* update the fenced JSON */
    txt = txt.replace(ENTRY_REGEX, (_, json) => {
      const obj = JSON.parse(json);
      obj.mentionedOnPages = [...pages].sort();
      return '```glossary-entry\n' + JSON.stringify(obj, null, 2) + '\n```';
    });

    txt = stripSection(txt, 'Mentioned on pages');

    const list = [...pages].sort().map(p => `- [${p}](./${p})`).join('\n');
    txt = txt.trimEnd() +
      `\n\n## Mentioned on pages\n\n${list || '*None yet*'}\n`;

    await fs.writeFile(file, txt, 'utf8');
  }
}

/*───────────────────────────────────────────────────────────────────────────*/
/* utilities */

function stripSection (text, heading) {
  const idx = text.indexOf(`## ${heading}`);
  return idx === -1 ? text.trimEnd() : text.slice(0, idx).trimEnd();
}

function splitAtEntry (text) {
  const i = text.indexOf('```glossary-entry');
  return i === -1 ? [text, ''] : [text.slice(0, i), text.slice(i)];
}
