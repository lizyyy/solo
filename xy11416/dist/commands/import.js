"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommand = importCommand;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const database_1 = require("../database");
const importer_1 = require("../services/importer");
async function importCommand(filePaths, workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    const importService = new importer_1.ImportService(db, absoluteDir);
    const importOptions = {
        mode: options.mode || 'update',
        batchId: options.batch,
        operator: options.operator || 'cli',
        sourceType: options.sourceType,
    };
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalUpdated = 0;
    const allFailedRecords = [];
    for (const filePath of filePaths) {
        const absolutePath = path_1.default.resolve(filePath);
        if (!fs_1.default.existsSync(absolutePath)) {
            console.log(chalk_1.default.red(`✗ 文件不存在: ${filePath}`));
            continue;
        }
        console.log(chalk_1.default.blue(`\n导入文件: ${path_1.default.basename(absolutePath)}`));
        console.log(chalk_1.default.gray(`  路径: ${absolutePath}`));
        try {
            const result = await importService.importFile(absolutePath, importOptions);
            console.log(chalk_1.default.green(`  ✓ 批次号: ${result.batchId}`));
            console.log(chalk_1.default.gray(`  总计: ${result.totalRecords}`));
            console.log(chalk_1.default.green(`  成功: ${result.successCount}`));
            if (result.updatedCount > 0) {
                console.log(chalk_1.default.blue(`  更新: ${result.updatedCount}`));
            }
            if (result.skippedCount > 0) {
                console.log(chalk_1.default.yellow(`  跳过: ${result.skippedCount}`));
            }
            if (result.failedCount > 0) {
                console.log(chalk_1.default.red(`  失败: ${result.failedCount}`));
            }
            totalSuccess += result.successCount;
            totalFailed += result.failedCount;
            totalUpdated += result.updatedCount;
            allFailedRecords.push(...result.failedRecords.map(r => ({ ...r, batchId: result.batchId })));
        }
        catch (error) {
            console.log(chalk_1.default.red(`  ✗ 导入失败: ${error.message}`));
            totalFailed++;
        }
    }
    if (allFailedRecords.length > 0) {
        console.log(chalk_1.default.red('\n失败记录详情:'));
        const table = new cli_table3_1.default({
            head: ['批次号', '源文件', '行号', '错误信息'],
            colWidths: [12, 20, 8, 50],
            wordWrap: true,
        });
        for (const record of allFailedRecords) {
            table.push([
                record.batchId,
                record.sourceFile,
                record.rawLineNumber.toString(),
                record.errors.join('\n'),
            ]);
        }
        console.log(table.toString());
    }
    console.log('');
    console.log(chalk_1.default.blue('汇总:'));
    console.log(chalk_1.default.gray(`  成功: ${totalSuccess}, 失败: ${totalFailed}, 更新: ${totalUpdated}`));
}
//# sourceMappingURL=import.js.map