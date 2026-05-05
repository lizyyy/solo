#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { replayCommand } from './commands/replay';
import { compareCommand } from './commands/compare';
import { exportCommand } from './commands/export';

const program = new Command();

program
  .name('dcs')
  .description('分布式一致性模拟 CLI 工具 - 模拟 CAP、BASE、Raft、Paxos、分布式锁和最终一致性的事故剧本')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(replayCommand);
program.addCommand(compareCommand);
program.addCommand(exportCommand);

program.parse(process.argv);
