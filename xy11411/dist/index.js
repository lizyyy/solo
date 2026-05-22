#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const init_1 = require("./commands/init");
const import_1 = require("./commands/import");
const fix_1 = require("./commands/fix");
const report_1 = require("./commands/report");
const history_1 = require("./commands/history");
const export_1 = require("./commands/export");
const database_1 = require("./services/database");
const program = new commander_1.Command();
program
    .name('tea-inspect')
    .description('连锁茶饮原料多源导入巡检 CLI 工具')
    .version('1.0.0')
    .hook('preAction', async (thisCommand, actionCommand) => {
    const skipInit = ['init', 'help', '--help', '-h', '--version', '-V'];
    if (!skipInit.includes(actionCommand.name()) && !skipInit.some(s => process.argv.includes(s))) {
        if (!database_1.dbService.isInitialized()) {
            console.error(chalk_1.default.red('✗ 系统未初始化，请先运行: tea-inspect init'));
            process.exit(1);
        }
        await database_1.dbService.initialize();
    }
});
program
    .command('init')
    .description('初始化系统，创建工作目录和数据库')
    .option('-f, --force', '强制重新初始化')
    .action(async (options) => {
    await (0, init_1.initCommand)(options);
    process.exit(0);
});
program
    .command('import <file>')
    .description('导入数据文件（支持订货表、损耗登记、总部价格表）')
    .option('-t, --source-type <type>', '指定数据源类型: order|loss|price')
    .option('--allow-duplicate', '允许重复导入')
    .option('--skip-check', '跳过自动校验')
    .option('-o, --operator <id>', '操作员ID，默认: default-admin')
    .action(async (filePath, options) => {
    await (0, import_1.importCommand)(filePath, options);
    process.exit(0);
});
program
    .command('check')
    .description('执行数据校验')
    .option('-b, --batch-id <id>', '指定批次ID')
    .option('-r, --record-id <id>', '指定记录ID')
    .option('-o, --operator <id>', '操作员ID，默认: default-admin')
    .action(async (options) => {
    await (0, import_1.checkCommand)(options);
    process.exit(0);
});
program
    .command('fix <recordId>')
    .description('修正数据记录')
    .requiredOption('-f, --field <field>', '要修改的字段名')
    .requiredOption('-v, --value <value>', '新值')
    .requiredOption('-r, --reason <reason>', '修正原因')
    .option('--recheck', '修正后重新校验')
    .option('-o, --operator <id>', '操作员ID，默认: default-admin')
    .action(async (recordId, options) => {
    await (0, fix_1.fixCommand)(recordId, options);
    process.exit(0);
});
program
    .command('reimport <recordId>')
    .description('重新导入记录')
    .option('-o, --operator <id>', '操作员ID，默认: default-admin')
    .action(async (recordId, options) => {
    await (0, fix_1.reimportCommand)(recordId, options);
    process.exit(0);
});
program
    .command('report')
    .description('生成巡检报表')
    .option('-b, --batch-id <id>', '指定批次ID')
    .option('-f, --format <format>', '输出格式: console')
    .option('--failures', '只显示失败记录详情')
    .option('-o, --operator <id>', '操作员ID，默认: default-admin')
    .action(async (options) => {
    await (0, report_1.reportCommand)(options);
    process.exit(0);
});
program
    .command('history')
    .description('查看历史记录')
    .option('-r, --record-id <id>', '查看指定记录的变更历史')
    .option('-n, --limit <number>', '显示条数，默认: 20', parseInt)
    .option('--audit', '查看审计日志')
    .option('-o, --operator <id>', '操作员ID，默认: default-admin')
    .action(async (options) => {
    await (0, history_1.historyCommand)(options);
    process.exit(0);
});
program
    .command('export')
    .description('导出数据')
    .option('-f, --format <format>', '导出格式: json|csv|excel，默认: json')
    .option('-o, --output <path>', '输出文件路径')
    .option('-b, --batch-id <id>', '指定批次ID')
    .option('--valid-only', '只导出有效记录')
    .option('--include-history', 'JSON格式时包含状态变更和校验历史')
    .option('--operator <id>', '操作员ID，默认: default-admin')
    .action(async (options) => {
    await (0, export_1.exportCommand)(options);
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('\n');
    console.log(chalk_1.default.yellow('正在关闭...'));
    await database_1.dbService.close();
    process.exit(0);
});
process.on('exit', async () => {
    await database_1.dbService.close();
});
program.parseAsync(process.argv).catch(async (error) => {
    console.error(chalk_1.default.red('✗ 执行失败:'), error.message);
    await database_1.dbService.close();
    process.exit(1);
});
