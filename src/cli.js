// ── src/cli.js ─────────────────────────────────────────────────────────────
import { Command }       from 'commander';
import chalk             from 'chalk';

import { initCommand }    from './commands/init.js';
import { glossCommand }   from './commands/gloss.js';
import { addCommand }     from './commands/add.js';
import { searchCommand }  from './commands/search.js';
import { renameCommand }  from './commands/rename.js';
import { statsCommand }   from './commands/stats.js';
import { tocCommand }     from './commands/toc.js';
import { suggestCommand } from './commands/suggest.js';
import { delinkCommand }  from './commands/delink.js';

/* ───────────────────────── Commander set‑up ────────────────────────── */
const program = new Command();

program
  .name('clio')
  .description('Markdown glossary helpers')
  .version('0.9.4')
  /* nicer UX on typos */
  .showSuggestionAfterError();

/* explicit sub‑commands */
program.command('init')
  .description('Initialise a Clio project in the current directory')
  .action(initCommand);

program.command('gloss')
  .description('Relink glossary terms across the docs')
  .action(glossCommand);

program.command('add')
  .description('Interactively add a glossary term')
  .action(addCommand);

program.command('search [query]')
  .description('Fuzzy‑search glossary terms')
  .action(searchCommand);

program.command('rename')
  .description('Interactively rename a glossary term everywhere')
  .action(renameCommand);

program.command('stats')
  .description('Show glossary usage statistics')
  .action(statsCommand);

program.command('toc')
  .description('Rebuild the Glossary Table of Contents')
  .action(tocCommand);

program.command('suggest')
  .description('Analyse docs and suggest potential glossary terms')
  .action(suggestCommand);

program.command('delink')
  .description('Remove local markdown links to other markdown files')
  .action(delinkCommand);

/* “help” is already built‑in (`clio --help`), but keep an alias */
program.command('help').action(() => program.outputHelp());

/* ───── unknown command handler (must be before parse) ───── */
program.on('command:*', (operands) => {
  console.error(
    chalk.red(`✖  Unknown command “${operands[0]}”. See “clio help”.`)
  );
  process.exitCode = 1;
});

/* ───── default behaviour: run `gloss` when no args ───── */
const userArgs = process.argv.slice(2);
if (userArgs.length === 0) {
  /* no sub‑command given – call gloss directly */
  glossCommand();
} else {
  /* parse normally */
  program.parseAsync(process.argv);
}
