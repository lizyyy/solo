"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const query_1 = require("./commands/query");
const batch_1 = require("./commands/batch");
const export_1 = require("./commands/export");
const program = new commander_1.Command();
program
    .name('rsa')
    .description('返回样本归档命令行工具')
    .version('1.0.0');
program
    .command('query')
    .description('查询记录（支持按批次、状态、关键词等过滤）')
    .option('-b, --batch <batchId>', '批次号')
    .option('-s, --status <status>', '状态: success/abnormal/pending/manually_corrected')
    .option('-a, --abnormal <type>', '异常类型: field_truncated/data_missing/format_error/duplicate')
    .option('--start <date>', '开始日期 (ISO格式)')
    .option('--end <date>', '结束日期 (ISO格式)')
    .option('-k, --keyword <keyword>', '关键词搜索')
    .action((options) => {
    (0, query_1.queryCommand)(options);
});
program
    .command('batches')
    .description('列出所有批次')
    .action(() => {
    (0, query_1.listBatches)();
});
program
    .command('preview <batchId>')
    .description('预览批量处理')
    .action(async (batchId) => {
    await (0, batch_1.previewBatchProcess)(batchId);
});
program
    .command('process <batchId>')
    .description('执行批量处理（含确认步骤）')
    .action(async (batchId) => {
    await (0, batch_1.executeBatchProcess)(batchId);
});
program
    .command('correct <recordId>')
    .description('人工修正记录')
    .action(async (recordId) => {
    await (0, batch_1.correctRecord)(recordId);
});
program
    .command('export')
    .description('导出记录')
    .option('-b, --batch <batchId>', '批次号')
    .option('-f, --format <format>', '导出格式: json/csv (默认: json)')
    .option('--abnormal-only', '仅导出异常记录')
    .action((options) => {
    (0, export_1.exportRecords)(options);
});
program
    .command('detail <recordId>')
    .description('查看记录详情')
    .action((recordId) => {
    (0, export_1.showRecordDetail)(recordId);
});
program
    .command('seed')
    .description('生成测试数据')
    .action(() => {
    require('./seed-data');
});
program
    .command('test')
    .description('运行自检脚本')
    .action(() => {
    require('./self-test');
});
console.log(chalk_1.default.blue.bold('\n╔══════════════════════════════════════╗'));
console.log(chalk_1.default.blue.bold('║     返回样本归档命令行工具 (RSA)     ║'));
console.log(chalk_1.default.blue.bold('╚══════════════════════════════════════╝\n'));
program.parseAsync(process.argv).catch(err => {
    console.error(chalk_1.default.red('执行出错:'), err);
    process.exit(1);
});
