#!/usr/bin/env node

import { Command } from 'commander';
import { registerImportCommand } from './commands/import';
import { registerCalculateCommand } from './commands/calculate';
import { registerReportCommand } from './commands/report';
import { registerStatusCommand } from './commands/status';

const program = new Command();

program
  .name('bdc')
  .description('票据贴现利息复算 CLI')
  .version('1.0.0');

registerImportCommand(program);
registerCalculateCommand(program);
registerReportCommand(program);
registerStatusCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
