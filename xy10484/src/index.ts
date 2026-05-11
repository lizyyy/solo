#!/usr/bin/env node

import { Command } from 'commander';
import { registerImportCommand } from './commands/import';
import { registerListCommand } from './commands/list';
import { registerDetailCommand } from './commands/detail';
import { registerReviewCommand } from './commands/review';
import { registerReportCommand } from './commands/report';
import { registerStatsCommand } from './commands/stats';
import { registerResetCommand } from './commands/reset';

const program = new Command();

program
  .name('logistics-abnormal')
  .description('物流签收异常 CLI - 帮助客服处理物流签收异常问题')
  .version('1.0.0');

registerImportCommand(program);
registerListCommand(program);
registerDetailCommand(program);
registerReviewCommand(program);
registerReportCommand(program);
registerStatsCommand(program);
registerResetCommand(program);

program.parse(process.argv);
