#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const cli_1 = require("./cli");
const program = new commander_1.Command();
program
    .name('release-window')
    .description('发版依赖窗口检查 CLI')
    .version('1.0.0');
const cli = new cli_1.CLI();
program
    .command('init')
    .description('初始化发版计划')
    .argument('<releasePlanId>', '发版计划ID')
    .argument('<releaseName>', '发版计划名称')
    .option('--sample', '使用内置样例数据初始化（包含问题场景）')
    .option('--success-sample', '使用成功通过样例数据初始化')
    .option('--data-dir <dir>', '指定数据目录')
    .action((releasePlanId, releaseName, options) => {
    try {
        const localCli = options.dataDir ? new cli_1.CLI(options.dataDir) : cli;
        localCli.init(releasePlanId, releaseName, options);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
});
program
    .command('import')
    .description('导入发布数据')
    .argument('<filePath>', 'JSON 数据文件路径')
    .option('--type <type>', '导入类型: auto|services|dependencies|migrations|switches|contacts|waivers', 'auto')
    .option('--data-dir <dir>', '指定数据目录')
    .action((filePath, options) => {
    try {
        const localCli = options.dataDir ? new cli_1.CLI(options.dataDir) : cli;
        localCli.import(filePath, options);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
});
program
    .command('check')
    .description('执行发版前检查')
    .option('--operator <name>', '操作人名称')
    .option('--data-dir <dir>', '指定数据目录')
    .action((options) => {
    try {
        const localCli = options.dataDir ? new cli_1.CLI(options.dataDir) : cli;
        localCli.check(options);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
});
program
    .command('detail')
    .description('查看详细信息')
    .option('--service <name>', '查看指定服务详情（服务ID或名称）')
    .option('--history', '查看检查历史记录')
    .option('--check-history-id <id>', '查看指定检查历史详情')
    .option('--data-dir <dir>', '指定数据目录')
    .action((options) => {
    try {
        const localCli = options.dataDir ? new cli_1.CLI(options.dataDir) : cli;
        localCli.detail(options);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
});
program
    .command('report')
    .description('生成检查报告')
    .option('--output <file>', '输出文件路径')
    .option('--format <format>', '报告格式: text|json', 'text')
    .option('--data-dir <dir>', '指定数据目录')
    .action((options) => {
    try {
        const localCli = options.dataDir ? new cli_1.CLI(options.dataDir) : cli;
        localCli.report(options);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map