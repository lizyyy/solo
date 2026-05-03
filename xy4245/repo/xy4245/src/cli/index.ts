#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { initCommand } from './commands/init';
import { scanCommand } from './commands/scan';
import { checkCommand } from './commands/check';
import { reviewCommand } from './commands/review';
import { reportCommand } from './commands/report';

function getVersion(): string {
  try {
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      return pkg.version || '1.0.0';
    }
  } catch {
    // ignore
  }
  return '1.0.0';
}

const version = getVersion();

const program = new Command();

program
  .name('foi')
  .description('焦点顺序体检员 - 无障碍审查员专用命令行工具')
  .version(version, '-v, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息');

program.addCommand(initCommand);
program.addCommand(scanCommand);
program.addCommand(checkCommand);
program.addCommand(reviewCommand);
program.addCommand(reportCommand);

program.on('command:*', (operands: string[]) => {
  console.error(chalk.red(`错误: 未知命令 "${operands[0]}"`));
  console.log(chalk.yellow('运行 "foi --help" 查看可用命令'));
  process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
