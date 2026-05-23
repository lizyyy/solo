"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixCommand = fixCommand;
exports.fixedCommand = fixedCommand;
const fixService_1 = require("../services/fixService");
const database_1 = require("../db/database");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
async function fixCommand(batchId, options) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    const operator = options.operator || process.env.USER || 'unknown';
    if (options.auto) {
        console.log(chalk_1.default.blue(`正在自动修复批次: ${batchId}`));
        console.log('');
        try {
            const results = (0, fixService_1.autoFixBySuggestion)(batchId, operator);
            if (results.length === 0) {
                console.log(chalk_1.default.yellow('没有可自动修复的记录'));
                return 0;
            }
            console.log(chalk_1.default.green(`✓ 自动修复完成！共修复 ${results.length} 条记录`));
            console.log('');
            const table = new cli_table3_1.default({
                head: ['行号', '访客姓名', '字段', '旧值', '新值', '原因'],
                colWidths: [8, 12, 12, 15, 15, 30]
            });
            for (const result of results) {
                table.push([
                    result.originalLineNo,
                    result.visitorName,
                    result.field,
                    result.oldValue || '-',
                    result.newValue,
                    result.reason
                ]);
            }
            console.log(table.toString());
            console.log('');
            console.log(chalk_1.default.cyan('下一步操作:'));
            console.log(`  生成报表: park-inspect report ${batchId}`);
            return 0;
        }
        catch (error) {
            console.error(chalk_1.default.red('自动修复失败:'), error.message);
            return 1;
        }
    }
    if (options.record && options.field && options.value) {
        console.log(chalk_1.default.blue(`正在修复记录: ${options.record}`));
        console.log('');
        try {
            const result = (0, fixService_1.fixRecord)({
                recordId: options.record,
                field: options.field,
                newValue: options.value,
                operator,
                reason: options.reason || '手动修复'
            });
            console.log(chalk_1.default.green('✓ 修复成功！'));
            console.log('');
            console.log(chalk_1.default.cyan('修复详情:'));
            console.log(`  行号: ${result.originalLineNo}`);
            console.log(`  访客: ${result.visitorName}`);
            console.log(`  字段: ${result.field}`);
            console.log(`  旧值: ${result.oldValue || '-'}`);
            console.log(`  新值: ${result.newValue}`);
            console.log(`  原因: ${result.reason}`);
            return 0;
        }
        catch (error) {
            console.error(chalk_1.default.red('修复失败:'), error.message);
            return 1;
        }
    }
    console.error(chalk_1.default.red('错误: 请指定修复方式。使用 --auto 自动修复，或指定 --record --field --value 手动修复'));
    return 1;
}
async function fixedCommand(batchId) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    const records = (0, fixService_1.getFixedRecords)(batchId);
    if (records.length === 0) {
        console.log(chalk_1.default.yellow('该批次无已修复记录'));
        return 0;
    }
    console.log(chalk_1.default.green(`已修复记录 (共 ${records.length} 条):`));
    console.log('');
    const table = new cli_table3_1.default({
        head: ['行号', '访客姓名', '旧值', '新值'],
        colWidths: [8, 12, 30, 30]
    });
    for (const record of records) {
        table.push([
            record.original_line_no,
            record.visitor_name,
            record.old_value || '-',
            record.new_value || '-'
        ]);
    }
    console.log(table.toString());
    return 0;
}
