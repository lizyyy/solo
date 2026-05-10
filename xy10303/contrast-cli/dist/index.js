#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dataStore_1 = require("./services/dataStore");
const import_1 = require("./commands/import");
const check_1 = require("./commands/check");
const pending_1 = require("./commands/pending");
const correct_1 = require("./commands/correct");
const report_1 = require("./commands/report");
const logger_1 = require("./utils/logger");
const date_fns_1 = require("date-fns");
const program = new commander_1.Command();
const store = new dataStore_1.DataStore();
program
    .name('contrast-cli')
    .description('影像科增强药剂核销 CLI 工具')
    .version('1.0.0');
program
    .command('import <file>')
    .description('导入数据 (支持 CSV/JSON 格式)')
    .requiredOption('-t, --type <type>', '数据类型: appointments | batches | usage')
    .action((file, options) => {
    const validTypes = ['appointments', 'batches', 'usage'];
    if (!validTypes.includes(options.type)) {
        logger_1.logger.error(`无效的数据类型: ${options.type}`);
        logger_1.logger.info(`有效类型: ${validTypes.join(', ')}`);
        process.exit(1);
    }
    (0, import_1.handleImport)(file, options.type, store);
});
program
    .command('check [date]')
    .description('执行核销检查')
    .action((date) => {
    const targetDate = date || (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
    (0, check_1.handleCheck)(targetDate, store);
});
program
    .command('pending [date]')
    .description('查看待处理项')
    .action((date) => {
    const targetDate = date || (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
    (0, pending_1.handlePending)(targetDate, store);
});
program
    .command('correct <date>')
    .description('标记人工修正')
    .requiredOption('--type <type>', '修正类型: dose_adjustment | refund_confirm | batch_merge | other')
    .option('-a, --appointment <id>', '关联预约号')
    .option('-b, --batch <number>', '关联批号')
    .requiredOption('-r, --reason <text>', '修正原因')
    .requiredOption('-o, --operator <name>', '操作人')
    .option('--original <value>', '原始值')
    .option('--corrected <value>', '修正后的值')
    .action((date, options) => {
    (0, correct_1.handleCorrect)(date, {
        type: options.type,
        appointmentId: options.appointment,
        batchNumber: options.batch,
        reason: options.reason,
        operator: options.operator,
        original: options.original,
        corrected: options.corrected
    }, store);
});
program
    .command('report [date]')
    .description('生成日结报告')
    .option('-o, --output <file>', '输出文件路径')
    .option('-f, --format <format>', '输出格式: text | json (默认: text)')
    .action((date, options) => {
    const targetDate = date || (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
    const outputFormat = options.format === 'json' ? 'json' : 'text';
    (0, report_1.handleReport)(targetDate, { output: options.output, format: outputFormat }, store);
});
program
    .command('clear')
    .description('清空所有数据 (谨慎使用)')
    .option('-f, --force', '强制清空，不提示')
    .action((options) => {
    if (!options.force) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        readline.question('确认清空所有数据？(y/N) ', (answer) => {
            readline.close();
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                store.clear();
                logger_1.logger.success('数据已清空');
            }
            else {
                logger_1.logger.info('操作已取消');
            }
        });
    }
    else {
        store.clear();
        logger_1.logger.success('数据已清空');
    }
});
program.parse(process.argv);
