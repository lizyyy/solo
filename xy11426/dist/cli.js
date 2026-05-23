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
const check_1 = require("./commands/check");
const fix_1 = require("./commands/fix");
const report_1 = require("./commands/report");
const history_1 = require("./commands/history");
const export_1 = require("./commands/export");
const tasks_1 = require("./commands/tasks");
const program = new commander_1.Command();
program
    .name('park-inspect')
    .description('园区访客通行多源导入巡检 CLI')
    .version('1.0.0');
program
    .command('init')
    .description('初始化数据库')
    .action(async () => {
    const exitCode = await (0, init_1.initCommand)();
    process.exit(exitCode);
});
program
    .command('import <file>')
    .description('导入数据文件')
    .requiredOption('-s, --source <type>', '数据源类型: visitor_appointment|gate_record|temp_plate|refund_flow')
    .option('-t, --strategy <strategy>', '导入策略: ignore|overwrite|append', 'append')
    .option('-o, --operator <name>', '操作员名称')
    .action(async (file, options) => {
    const exitCode = await (0, import_1.importCommand)(file, options);
    process.exit(exitCode);
});
program
    .command('list')
    .description('列出导入批次')
    .action(async () => {
    const exitCode = await (0, import_1.listCommand)();
    process.exit(exitCode);
});
program
    .command('check <batchId>')
    .description('校验批次数据')
    .option('-o, --operator <name>', '操作员名称')
    .action(async (batchId, options) => {
    const exitCode = await (0, check_1.checkCommand)(batchId, options);
    process.exit(exitCode);
});
program
    .command('failures <batchId>')
    .description('查看批次失败记录')
    .action(async (batchId) => {
    const exitCode = await (0, check_1.failuresCommand)(batchId);
    process.exit(exitCode);
});
program
    .command('fix <batchId>')
    .description('修复数据问题')
    .option('-a, --auto', '自动修复可自动修复的问题')
    .option('-r, --record <recordId>', '指定记录ID进行手动修复')
    .option('-f, --field <field>', '要修复的字段名')
    .option('-v, --value <value>', '修复后的值')
    .option('--reason <reason>', '修复原因')
    .option('-o, --operator <name>', '操作员名称')
    .action(async (batchId, options) => {
    const exitCode = await (0, fix_1.fixCommand)(batchId, options);
    process.exit(exitCode);
});
program
    .command('fixed <batchId>')
    .description('查看已修复记录')
    .action(async (batchId) => {
    const exitCode = await (0, fix_1.fixedCommand)(batchId);
    process.exit(exitCode);
});
program
    .command('report <batchId>')
    .description('生成巡检报表')
    .action(async (batchId) => {
    const exitCode = await (0, report_1.reportCommand)(batchId);
    process.exit(exitCode);
});
program
    .command('history')
    .description('查看操作历史')
    .option('-b, --batch <batchId>', '按批次筛选')
    .option('-r, --record <recordId>', '按记录筛选')
    .option('-o, --operator <name>', '按操作员筛选')
    .option('-l, --limit <number>', '显示条数', '100')
    .action(async (options) => {
    const exitCode = await (0, history_1.historyCommand)(options);
    process.exit(exitCode);
});
program
    .command('export <batchId>')
    .description('导出数据')
    .option('-f, --format <format>', '导出格式: csv|excel', 'csv')
    .option('--failures', '仅导出失败记录')
    .option('--audit', '导出审计日志')
    .option('--report', '导出报表文本')
    .option('-o, --output <path>', '输出文件路径')
    .action(async (batchId, options) => {
    const exitCode = await (0, export_1.exportCommand)(batchId, options);
    process.exit(exitCode);
});
program
    .command('tasks')
    .description('管理异步任务')
    .option('-s, --status <status>', '按状态筛选: pending|retry|manual|failed')
    .option('--retry <taskId>', '标记任务为重试')
    .option('--manual <taskId>', '标记任务为等待人工处理')
    .action(async (options) => {
    const exitCode = await (0, tasks_1.tasksCommand)(options);
    process.exit(exitCode);
});
program.addHelpText('before', `
${chalk_1.default.cyan('╔══════════════════════════════════════════════════════════════╗')}
${chalk_1.default.cyan('║')}              园区访客通行多源导入巡检 CLI                  ${chalk_1.default.cyan('║')}
${chalk_1.default.cyan('╚══════════════════════════════════════════════════════════════╝')}
`);
program.addHelpText('after', `
${chalk_1.default.bold('数据源类型:')}
  visitor_appointment  - 访客预约表
  gate_record          - 闸机记录
  temp_plate           - 临时车牌
  refund_flow          - 退款流水

${chalk_1.default.bold('导入策略:')}
  ignore    - 如果文件已导入过则忽略
  overwrite - 覆盖同类型旧数据
  append    - 追加数据（默认）

${chalk_1.default.bold('退出码:')}
  0 - 成功
  1 - 错误
  2 - 存在问题记录（校验、报表时）

${chalk_1.default.bold('常用流程:')}
  1. 初始化:   park-inspect init
  2. 导入:     park-inspect import data.csv -s visitor_appointment
  3. 查看列表: park-inspect list
  4. 校验:     park-inspect check <batchId>
  5. 修复:     park-inspect fix <batchId> --auto
  6. 报表:     park-inspect report <batchId>
  7. 导出:     park-inspect export <batchId>
`);
program.parseAsync(process.argv).catch((err) => {
    console.error(chalk_1.default.red('错误:'), err.message);
    process.exit(1);
});
