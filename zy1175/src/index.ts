#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { initCommand } from './commands/init';
import { importCommand } from './commands/import';
import { checkCommand } from './commands/check';
import { funnelCommand } from './commands/funnel';
import { diffCommand } from './commands/diff';
import { exportCommand } from './commands/export';
import { AppContext } from './types';

const program = new Command();
const appContext: AppContext = {
  schema: null,
  events: [],
  routes: [],
  releaseChanges: [],
  warehouseSamples: [],
};

program
  .name('tracking-analyzer')
  .description('CLI tool for analyzing frontend tracking events and funnel data')
  .version(version);

initCommand(program, appContext);
importCommand(program, appContext);
checkCommand(program, appContext);
funnelCommand(program, appContext);
diffCommand(program, appContext);
exportCommand(program, appContext);

program.on('command:*', (operands) => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log(chalk.yellow('Use "tracking-analyzer --help" for available commands.'));
  process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
