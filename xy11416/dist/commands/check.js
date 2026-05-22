"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCommand = checkCommand;
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const database_1 = require("../database");
async function checkCommand(workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    console.log(chalk_1.default.blue('数据质量检查'));
    console.log('');
    const errors = await db.getUnresolvedErrors();
    const failedRecords = await db.getFailedRecords(options.batch);
    if (failedRecords.length === 0 && errors.length === 0) {
        console.log(chalk_1.default.green('✓ 所有数据检查通过!'));
        return;
    }
    console.log(chalk_1.default.red(`发现 ${failedRecords.length} 条失败记录, ${errors.length} 个验证错误`));
    console.log('');
    if (failedRecords.length > 0) {
        console.log(chalk_1.default.red('失败记录:'));
        const table = new cli_table3_1.default({
            head: ['记录ID', '源文件', '行号', '错误'],
            colWidths: [14, 22, 8, 46],
            wordWrap: true,
        });
        for (const record of failedRecords.slice(0, options.all ? undefined : 20)) {
            table.push([
                record.id,
                record.sourceFile,
                record.rawLineNumber.toString(),
                record.errors.join('\n'),
            ]);
        }
        console.log(table.toString());
        if (!options.all && failedRecords.length > 20) {
            console.log(chalk_1.default.yellow(`  还有 ${failedRecords.length - 20} 条记录，使用 --all 查看全部`));
        }
        console.log('');
    }
    if (errors.length > 0) {
        console.log(chalk_1.default.yellow('验证错误详情:'));
        const table = new cli_table3_1.default({
            head: ['错误ID', '字段', '错误码', '错误信息', '严重程度'],
            colWidths: [14, 12, 18, 32, 10],
            wordWrap: true,
        });
        for (const error of errors.slice(0, options.all ? undefined : 20)) {
            table.push([
                error.id,
                error.fieldName,
                error.errorCode,
                error.errorMessage,
                error.severity === 'error' ? chalk_1.default.red('错误') : chalk_1.default.yellow('警告'),
            ]);
        }
        console.log(table.toString());
        if (!options.all && errors.length > 20) {
            console.log(chalk_1.default.yellow(`  还有 ${errors.length - 20} 个错误，使用 --all 查看全部`));
        }
    }
    console.log('');
    console.log(chalk_1.default.blue('修复建议:'));
    console.log(chalk_1.default.gray('  1. 运行 pmi fix --record <记录ID> 人工修正单条记录'));
    console.log(chalk_1.default.gray('  2. 修正源文件后重新导入: pmi import <文件路径>'));
    console.log(chalk_1.default.gray('  3. 查看原始内容: pmi show <记录ID>'));
}
//# sourceMappingURL=check.js.map