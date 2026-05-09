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
const history_1 = require("./commands/history");
const replay_1 = require("./commands/replay");
const cache_1 = require("./commands/cache");
const report_1 = require("./commands/report");
const store_1 = require("./storage/store");
const program = new commander_1.Command();
program
    .name('sir')
    .description('搜索索引重建回放 CLI 工具')
    .version('1.0.0');
program
    .command('init')
    .description('初始化数据目录和配置')
    .option('--force', '强制重新初始化（会清除已有数据）')
    .action((options) => {
    (0, init_1.initCommand)(options);
});
const importCmd = program
    .command('import')
    .description('导入数据（索引快照或源数据）');
importCmd
    .command('snapshot <file>')
    .description('导入索引快照')
    .requiredOption('--name <name>', '快照名称')
    .option('--description <desc>', '快照描述')
    .action((file, options) => {
    (0, import_1.importSnapshotCommand)(file, options);
});
importCmd
    .command('source <file>')
    .description('导入源数据')
    .requiredOption('--name <name>', '源数据名称')
    .option('--description <desc>', '源数据描述')
    .requiredOption('--type <type>', '来源类型: database|api|file')
    .action((file, options) => {
    (0, import_1.importSourceCommand)(file, options);
});
const listCmd = program
    .command('list')
    .description('列出各类资源');
listCmd
    .command('snapshots')
    .description('列出所有索引快照')
    .action(() => {
    (0, check_1.listSnapshotsCommand)();
});
listCmd
    .command('sources')
    .description('列出所有源数据')
    .action(() => {
    (0, check_1.listSourcesCommand)();
});
listCmd
    .command('checks')
    .description('列出所有检查结果')
    .action(() => {
    (0, history_1.listChecksCommand)();
});
listCmd
    .command('replays')
    .description('列出所有回放任务')
    .action(() => {
    (0, history_1.listReplaysCommand)();
});
listCmd
    .command('caches')
    .description('列出所有缓存刷新记录')
    .action(() => {
    (0, history_1.listCachesCommand)();
});
listCmd
    .command('reports')
    .description('列出所有报告')
    .action(() => {
    (0, report_1.listReportsCommand)();
});
program
    .command('check <snapshotId> <sourceId>')
    .description('比对索引快照和源数据，检测字段缺失')
    .option('-v, --verbose', '显示详细问题信息')
    .option('--limit <number>', 'verbose 模式下显示的问题数量上限', '10')
    .action((snapshotId, sourceId, options) => {
    (0, check_1.checkCommand)(snapshotId, sourceId, {
        verbose: options.verbose,
        limit: parseInt(options.limit, 10),
    });
});
program
    .command('history')
    .description('查看操作历史记录')
    .option('--limit <number>', '显示的记录数量上限', '20')
    .option('--type <type>', '按类型过滤: init|import|check|replay|cache|report')
    .action((options) => {
    (0, history_1.historyCommand)({
        limit: parseInt(options.limit, 10),
        type: options.type,
    });
});
const replayCmd = program
    .command('replay')
    .description('重建回放相关操作');
replayCmd
    .command('run <checkResultId>')
    .description('执行重建回放')
    .requiredOption('--name <name>', '任务名称')
    .option('--description <desc>', '任务描述')
    .option('--dry-run', '预演模式，不实际执行')
    .option('--product-ids <ids>', '指定商品 ID（逗号分隔），默认回放所有问题商品')
    .action((checkResultId, options) => {
    (0, replay_1.replayCommand)(checkResultId, options);
});
replayCmd
    .command('status <taskId>')
    .description('查看回放任务状态')
    .action((taskId) => {
    (0, replay_1.replayStatusCommand)(taskId);
});
program
    .command('cache')
    .description('缓存刷新操作')
    .option('--replay-task-id <id>', '基于回放任务刷新')
    .option('--check-result-id <id>', '基于检查结果刷新')
    .option('--product-ids <ids>', '手动指定商品 ID（逗号分隔）')
    .option('--dry-run', '预演模式')
    .action((options) => {
    (0, cache_1.cacheRefreshCommand)(options);
});
const reportCmd = program
    .command('report')
    .description('报告相关操作');
reportCmd
    .command('list')
    .description('列出所有报告')
    .action(() => {
    (0, report_1.listReportsCommand)();
});
reportCmd
    .command('generate')
    .description('生成报告')
    .requiredOption('--type <type>', '报告类型: field_missing|replay_summary|cache_summary|comprehensive')
    .requiredOption('--name <name>', '报告名称')
    .option('--check-result-id <id>', '检查结果 ID（字段缺失/综合报告需要）')
    .option('--replay-task-id <id>', '回放任务 ID（回放/综合报告需要）')
    .option('--cache-record-id <id>', '缓存记录 ID（缓存/综合报告需要）')
    .action((options) => {
    (0, report_1.generateReportCommand)(options);
});
reportCmd
    .command('view <reportId>')
    .description('查看报告内容')
    .action((reportId) => {
    (0, report_1.viewReportCommand)(reportId);
});
program
    .command('status')
    .description('查看当前状态')
    .action(() => {
    const initialized = (0, store_1.isInitialized)();
    console.log(chalk_1.default.white('📊 SIR CLI 状态:'));
    console.log();
    console.log(chalk_1.default.gray(`   初始化状态: ${initialized ? chalk_1.default.green('已初始化') : chalk_1.default.red('未初始化')}`));
    if (initialized) {
        console.log(chalk_1.default.gray(`   数据目录: ${(0, store_1.getDataDir)()}`));
    }
    else {
        console.log(chalk_1.default.gray('   请运行: sir init'));
    }
});
program.parseAsync(process.argv).catch((err) => {
    console.error(chalk_1.default.red('执行出错:'), err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map