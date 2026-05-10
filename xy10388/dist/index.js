#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const commands_1 = require("./cli/commands");
const program = new commander_1.Command();
program
    .name('book-match')
    .description('校园二手书撮合 CLI 工具')
    .version('1.0.0');
console.log(chalk_1.default.cyan.bold('\n📚 校园二手书撮合系统'));
console.log(chalk_1.default.gray('────────────────────────────────\n'));
program
    .command('import-sellers')
    .description('导入卖家清单 (JSON格式)')
    .argument('<file>', '卖家清单JSON文件路径')
    .action(async (file) => {
    await (0, commands_1.importSellers)(file);
});
program
    .command('import-buyers')
    .description('导入买家需求 (JSON格式)')
    .argument('<file>', '买家需求JSON文件路径')
    .action(async (file) => {
    await (0, commands_1.importBuyers)(file);
});
program
    .command('match')
    .description('进行撮合匹配')
    .option('-b, --buyer <id>', '按买家ID撮合')
    .option('-s, --seller <id>', '按卖家ID撮合')
    .action(async (options) => {
    await (0, commands_1.runMatching)(options.buyer, options.seller);
});
program
    .command('lock')
    .description('锁定交易')
    .requiredOption('-s, --seller <id>', '卖家清单ID')
    .requiredOption('-b, --buyer <id>', '买家需求ID')
    .action(async (options) => {
    await (0, commands_1.lockDeal)(options.seller, options.buyer);
});
program
    .command('unlock')
    .description('取消锁定，回到可撮合池')
    .requiredOption('-s, --seller <id>', '卖家清单ID')
    .requiredOption('-b, --buyer <id>', '买家需求ID')
    .action(async (options) => {
    await (0, commands_1.unlockDeal)(options.seller, options.buyer);
});
program
    .command('export')
    .description('导出撮合结果')
    .argument('<file>', '输出文件路径')
    .action(async (file) => {
    await (0, commands_1.exportResults)(file);
});
program
    .command('list-sellers')
    .description('列出所有卖家清单')
    .action(async () => {
    await (0, commands_1.listSellers)();
});
program
    .command('list-buyers')
    .description('列出所有买家需求')
    .action(async () => {
    await (0, commands_1.listBuyers)();
});
program.parse(process.argv);
