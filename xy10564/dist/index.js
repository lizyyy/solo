#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const init_1 = require("./commands/init");
const import_1 = require("./commands/import");
const check_1 = require("./commands/check");
const detail_1 = require("./commands/detail");
const report_1 = require("./commands/report");
const DEFAULT_DATA_DIR = './data';
const DEFAULT_OPERATOR = 'HR-USER';
const program = new commander_1.Command();
program
    .name('ssc')
    .description('社保基数申报 CLI 工具')
    .version('1.0.0');
program
    .command('init')
    .description('初始化项目')
    .option('-n, --name <name>', '项目名称', 'Social Security Declaration')
    .option('-y, --year <year>', '申报年度', '2025')
    .option('-m, --month <month>', '申报月份', '7')
    .option('--data-dir <dir>', '数据目录', DEFAULT_DATA_DIR)
    .option('--with-sample', '生成样例数据', true)
    .option('--operator <operator>', '操作者', DEFAULT_OPERATOR)
    .action((options) => {
    (0, init_1.executeInit)({
        dataDir: options.dataDir,
        name: options.name,
        year: parseInt(options.year),
        month: parseInt(options.month),
        withSample: options.withSample,
        operator: options.operator,
    });
});
program
    .command('import')
    .description('导入数据')
    .requiredOption('-t, --type <type>', '数据类型: employee|salary|employment|city-rule|historical')
    .requiredOption('-f, --file <file>', 'JSON 文件路径')
    .option('--data-dir <dir>', '数据目录', DEFAULT_DATA_DIR)
    .option('--operator <operator>', '操作者', DEFAULT_OPERATOR)
    .action((options) => {
    const validTypes = [
        'employee',
        'salary',
        'employment',
        'city-rule',
        'historical',
    ];
    if (!validTypes.includes(options.type)) {
        console.log(`❌ 无效的数据类型。请使用: ${validTypes.join(', ')}`);
        return;
    }
    (0, import_1.executeImport)({
        dataDir: options.dataDir,
        type: options.type,
        file: options.file,
        operator: options.operator,
    });
});
program
    .command('check')
    .description('检查数据完整性')
    .option('--data-dir <dir>', '数据目录', DEFAULT_DATA_DIR)
    .option('--operator <operator>', '操作者', DEFAULT_OPERATOR)
    .action((options) => {
    (0, check_1.executeCheck)({
        dataDir: options.dataDir,
        operator: options.operator,
    });
});
program
    .command('detail')
    .description('查看员工详情')
    .requiredOption('-e, --employee <identifier>', '员工 ID/工号/姓名')
    .option('--data-dir <dir>', '数据目录', DEFAULT_DATA_DIR)
    .option('--operator <operator>', '操作者', DEFAULT_OPERATOR)
    .action((options) => {
    (0, detail_1.executeDetail)({
        dataDir: options.dataDir,
        employee: options.employee,
        operator: options.operator,
    });
});
program
    .command('report')
    .description('生成申报报告')
    .option('-o, --output <file>', '导出 JSON 文件路径')
    .option('--data-dir <dir>', '数据目录', DEFAULT_DATA_DIR)
    .option('--operator <operator>', '操作者', DEFAULT_OPERATOR)
    .action((options) => {
    (0, report_1.executeReport)({
        dataDir: options.dataDir,
        output: options.output,
        operator: options.operator,
    });
});
program.parse(process.argv);
