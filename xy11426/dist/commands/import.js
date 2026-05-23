"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommand = importCommand;
exports.listCommand = listCommand;
const importService_1 = require("../services/importService");
const database_1 = require("../db/database");
const types_1 = require("../types");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
async function importCommand(filePath, options) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    const sourceType = options.source;
    const validSources = Object.values(types_1.DataSourceType);
    if (!validSources.includes(sourceType)) {
        console.error(chalk_1.default.red(`错误: 无效的数据源类型。可选值: ${validSources.join(', ')}`));
        return 1;
    }
    const strategy = options.strategy || types_1.ImportStrategy.APPEND;
    const validStrategies = Object.values(types_1.ImportStrategy);
    if (!validStrategies.includes(strategy)) {
        console.error(chalk_1.default.red(`错误: 无效的导入策略。可选值: ${validStrategies.join(', ')}`));
        return 1;
    }
    const operator = options.operator || process.env.USER || 'unknown';
    console.log(chalk_1.default.blue(`正在导入文件: ${filePath}`));
    console.log(chalk_1.default.gray(`  数据源: ${sourceType}`));
    console.log(chalk_1.default.gray(`  策略: ${strategy}`));
    console.log(chalk_1.default.gray(`  操作员: ${operator}`));
    console.log('');
    try {
        const result = await (0, importService_1.importFile)(filePath, {
            sourceType,
            strategy,
            operator,
            skipHeader: true
        });
        console.log(chalk_1.default.green('✓ 导入成功！'));
        console.log('');
        console.log(chalk_1.default.cyan('导入结果:'));
        console.log(`  批次ID: ${result.batchId}`);
        console.log(`  总记录数: ${result.totalRecords}`);
        console.log(`  成功导入: ${result.importedRecords}`);
        console.log(`  跳过: ${result.skippedRecords}`);
        console.log(`  策略: ${result.strategy}`);
        console.log('');
        console.log(chalk_1.default.cyan('下一步操作:'));
        console.log(`  校验数据: park-inspect check ${result.batchId}`);
        return 0;
    }
    catch (error) {
        console.error(chalk_1.default.red('导入失败:'), error.message);
        return 1;
    }
}
async function listCommand() {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    const batches = (0, importService_1.getBatches)();
    if (batches.length === 0) {
        console.log(chalk_1.default.yellow('暂无导入记录'));
        return 0;
    }
    const sourceTypeNames = {
        'visitor_appointment': '访客预约表',
        'gate_record': '闸机记录',
        'temp_plate': '临时车牌',
        'refund_flow': '退款流水'
    };
    const table = new cli_table3_1.default({
        head: ['批次ID', '文件名', '类型', '状态', '总数', '有效', '无效', '操作员', '导入时间'],
        colWidths: [38, 20, 12, 10, 6, 6, 6, 10, 20]
    });
    for (const batch of batches) {
        table.push([
            batch.id.substring(0, 36),
            batch.file_name,
            sourceTypeNames[batch.source_type] || batch.source_type,
            batch.status,
            batch.total_records,
            batch.valid_records || 0,
            batch.invalid_records || 0,
            batch.operator,
            batch.created_at
        ]);
    }
    console.log(table.toString());
    return 0;
}
