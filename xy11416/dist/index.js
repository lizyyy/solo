#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const init_1 = require("./commands/init");
const import_1 = require("./commands/import");
const check_1 = require("./commands/check");
const fix_1 = require("./commands/fix");
const report_1 = require("./commands/report");
const history_1 = require("./commands/history");
const export_1 = require("./commands/export");
const show_1 = require("./commands/show");
const program = new commander_1.Command();
function getWorkDir(customDir) {
    if (customDir) {
        return path_1.default.resolve(customDir);
    }
    const cwd = process.cwd();
    const configPath = path_1.default.join(cwd, 'pmi.json');
    if (fs_1.default.existsSync(configPath)) {
        return cwd;
    }
    return cwd;
}
program
    .name('pmi')
    .description('物业维修派单多源导入巡检 CLI')
    .version('1.0.0')
    .option('-w, --workdir <path>', '工作目录路径', process.cwd());
program
    .command('init')
    .description('初始化工作目录')
    .option('-f, --force', '强制重新初始化')
    .action(async (options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, init_1.initCommand)(workDir, options);
});
program
    .command('import')
    .description('导入数据文件')
    .argument('<files...>', '要导入的文件路径')
    .option('-m, --mode <mode>', '导入模式: create/update/skip', 'update')
    .option('-b, --batch <id>', '指定批次号')
    .option('-o, --operator <name>', '操作人', 'cli')
    .option('-t, --type <type>', '数据源类型: resident_report/technician_receipt/material_usage/supervisor_note')
    .action(async (files, options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, import_1.importCommand)(files, workDir, options);
});
program
    .command('check')
    .description('检查数据质量')
    .option('-b, --batch <id>', '检查指定批次')
    .option('-a, --all', '显示所有记录')
    .action(async (options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, check_1.checkCommand)(workDir, options);
});
program
    .command('fix')
    .description('修复数据问题')
    .option('-r, --record <id>', '记录ID')
    .option('-e, --error <id>', '错误ID')
    .option('-f, --field <name>', '字段名')
    .option('-v, --value <value>', '新值')
    .option('-o, --operator <name>', '操作人', 'cli')
    .option('--reason <text>', '修改原因')
    .option('--withdraw <id>', '撤回指定记录')
    .option('--freeze <order>', '冻结指定工单')
    .option('--unfreeze <order>', '解冻指定工单')
    .action(async (options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, fix_1.fixCommand)(workDir, options);
});
program
    .command('report')
    .description('生成巡检报告')
    .option('-b, --batch <id>', '指定批次')
    .option('-d, --detail', '显示详细信息')
    .action(async (options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, report_1.reportCommand)(workDir, options);
});
program
    .command('history')
    .description('查看导入历史')
    .option('-l, --limit <number>', '显示条数', '50')
    .option('-b, --batch <id>', '查看指定批次详情')
    .action(async (options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, history_1.historyCommand)(workDir, {
        limit: parseInt(options.limit),
        batch: options.batch,
    });
});
program
    .command('export')
    .description('导出数据')
    .option('-f, --format <format>', '导出格式: csv/xlsx/json', 'xlsx')
    .option('-o, --output <path>', '输出文件路径')
    .option('--frozen-only', '仅导出已冻结工单')
    .option('--include-raw', '包含原始来源信息')
    .action(async (options) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, export_1.exportCommand)(workDir, options);
});
program
    .command('show')
    .description('查看记录详情')
    .argument('<id>', '记录ID')
    .action(async (id) => {
    const workDir = getWorkDir(program.opts().workdir);
    await (0, show_1.showCommand)(id, workDir);
});
program.parseAsync(process.argv).catch((error) => {
    console.error('执行出错:', error.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map