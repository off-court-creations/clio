//  ── src/cli.js ─────────────────────────────────────────────────────────────
import { Command }       from 'commander';
import { addCommand }    from './commands/add.js';
import { searchCommand } from './commands/search.js';
import { glossCommand }  from './commands/gloss.js';
import { renameCommand } from './commands/rename.js';
import { statsCommand }  from './commands/stats.js';
import { tocCommand }  from './commands/toc.js';

const program = new Command();

program
  .name('clio')
  .description('Markdown Glossary Helpers')
  .version('0.3.4');

/* default (runs when no sub‑command supplied) */
program
  .command('gloss', { isDefault: true })
  .description('Relink glossary terms across the docs [default]')
  .action(glossCommand);

program
  .command('add')
  .description('Interactively add a glossary term')
  .action(addCommand);

program
  .command('search [query]')
  .description('Fuzzy‑search glossary terms')
  .action(searchCommand);

program
  .command('rename')
  .description('Interactively rename a glossary term everywhere')
  .action(renameCommand);

program
  .command('stats')
  .description('Show glossary usage statistics')
  .action(statsCommand);

program
  .command('toc')
  .description('Rebuild the Glossary Table of Contents')
  .action(tocCommand);

/* explicit help */
program
  .command('help')
  .description('Display detailed usage information')
  .action(() => {
    program.outputHelp();
  });

program.parseAsync();
