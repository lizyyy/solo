#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { 
  importSellers, 
  importBuyers, 
  runMatching, 
  lockDeal, 
  unlockDeal, 
  exportResults,
  listSellers,
  listBuyers
} from './cli/commands';

const program = new Command();

program
  .name('book-match')
  .description('校园二手书撮合 CLI 工具')
  .version('1.0.0');

console.log(chalk.cyan.bold('\n📚 校园二手书撮合系统'));
console.log(chalk.gray('────────────────────────────────\n'));

program
  .command('import-sellers')
  .description('导入卖家清单 (JSON格式)')
  .argument('<file>', '卖家清单JSON文件路径')
  .action(async (file: string) => {
    await importSellers(file);
  });

program
  .command('import-buyers')
  .description('导入买家需求 (JSON格式)')
  .argument('<file>', '买家需求JSON文件路径')
  .action(async (file: string) => {
    await importBuyers(file);
  });

program
  .command('match')
  .description('进行撮合匹配')
  .option('-b, --buyer <id>', '按买家ID撮合')
  .option('-s, --seller <id>', '按卖家ID撮合')
  .action(async (options: { buyer?: string; seller?: string }) => {
    await runMatching(options.buyer, options.seller);
  });

program
  .command('lock')
  .description('锁定交易')
  .requiredOption('-s, --seller <id>', '卖家清单ID')
  .requiredOption('-b, --buyer <id>', '买家需求ID')
  .action(async (options: { seller: string; buyer: string }) => {
    await lockDeal(options.seller, options.buyer);
  });

program
  .command('unlock')
  .description('取消锁定，回到可撮合池')
  .requiredOption('-s, --seller <id>', '卖家清单ID')
  .requiredOption('-b, --buyer <id>', '买家需求ID')
  .action(async (options: { seller: string; buyer: string }) => {
    await unlockDeal(options.seller, options.buyer);
  });

program
  .command('export')
  .description('导出撮合结果')
  .argument('<file>', '输出文件路径')
  .action(async (file: string) => {
    await exportResults(file);
  });

program
  .command('list-sellers')
  .description('列出所有卖家清单')
  .action(async () => {
    await listSellers();
  });

program
  .command('list-buyers')
  .description('列出所有买家需求')
  .action(async () => {
    await listBuyers();
  });

program.parse(process.argv);
