//  ── src/cli.js ─────────────────────────────────────────────────────────────
import { Command }       from 'commander';
import { addCommand }    from './commands/add.js';
import { searchCommand } from './commands/search.js';
import { glossCommand }  from './commands/gloss.js';
import { renameCommand } from './commands/rename.js';
import { statsCommand }  from './commands/stats.js';
import { tocCommand }  from './commands/toc.js';
import { initCommand } from './commands/init.js';
import { suggestCommand } from './commands/suggest.js';

const program = new Command();

program
  .name('clio')
  .description('Markdown Glossary Helpers')
  .version('0.9.3');

program.command('init')
  .description('Create .clio/ project marker in current directory')
  .action(initCommand);

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

program.command('suggest')
  .description('Analyse docs and suggest potential glossary terms')
  .action(suggestCommand);

program
  .command('help')
  .description('Display detailed usage information')
  .action(() => {
    program.outputHelp();
  });

program.parseAsync();
