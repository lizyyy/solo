"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportCommand = reportCommand;
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const moment_1 = __importDefault(require("moment"));
const database_1 = require("../database");
async function reportCommand(workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    console.log(chalk_1.default.blue('╔══════════════════════════════════════════════════╗'));
    console.log(chalk_1.default.blue('║           物业维修派单巡检报告                    ║'));
    console.log(chalk_1.default.blue('╚══════════════════════════════════════════════════╝'));
    console.log('');
    const history = await db.getImportHistory(10);
    const facts = await db.getFactRecords();
    const failedRecords = await db.getFailedRecords(options.batch);
    const errors = await db.getUnresolvedErrors();
    const stats = {
        totalOrders: facts.length,
        frozenOrders: facts.filter(f => f.isFrozen).length,
        imported: 0,
        failed: failedRecords.length,
        fixed: 0,
        withdrawn: 0,
        pending: 0,
    };
    if (options.batch) {
        const batchRecords = await db.getRawRecordsByBatch(options.batch);
        stats.imported = batchRecords.filter(r => r.status === 'imported').length;
        stats.fixed = batchRecords.filter(r => r.status === 'fixed').length;
        stats.withdrawn = batchRecords.filter(r => r.status === 'withdrawn').length;
        stats.pending = batchRecords.filter(r => r.status === 'pending').length;
    }
    else {
        for (const session of history) {
            const batchRecords = await db.getRawRecordsByBatch(session.batchId);
            stats.imported += batchRecords.filter(r => r.status === 'imported').length;
            stats.fixed += batchRecords.filter(r => r.status === 'fixed').length;
            stats.withdrawn += batchRecords.filter(r => r.status === 'withdrawn').length;
            stats.pending += batchRecords.filter(r => r.status === 'pending').length;
        }
    }
    const summaryTable = new cli_table3_1.default({
        head: ['指标', '数量'],
        colWidths: [30, 20],
    });
    summaryTable.push(['工单总数', stats.totalOrders.toString()], ['已冻结工单', stats.frozenOrders.toString()], ['成功导入记录', stats.imported.toString()], ['失败记录', chalk_1.default.red(stats.failed.toString())], ['已修正记录', chalk_1.default.green(stats.fixed.toString())], ['已撤回记录', chalk_1.default.gray(stats.withdrawn.toString())], ['待处理记录', stats.pending.toString()], ['未解决错误', chalk_1.default.red(errors.length.toString())]);
    console.log(chalk_1.default.yellow('一、总体统计'));
    console.log(summaryTable.toString());
    console.log('');
    if (history.length > 0) {
        console.log(chalk_1.default.yellow('二、最近导入批次'));
        const historyTable = new cli_table3_1.default({
            head: ['批次号', '源文件', '类型', '记录数', '状态', '时间'],
            colWidths: [12, 18, 12, 8, 10, 20],
        });
        for (const session of history) {
            const statusColor = session.status === 'completed' ? chalk_1.default.green : chalk_1.default.red;
            historyTable.push([
                session.batchId,
                session.sourceFile,
                session.sourceType,
                session.totalRecords.toString(),
                statusColor(session.status),
                (0, moment_1.default)(session.startedAt).format('YYYY-MM-DD HH:mm'),
            ]);
        }
        console.log(historyTable.toString());
        console.log('');
    }
    if (failedRecords.length > 0) {
        console.log(chalk_1.default.yellow('三、失败清单'));
        const failedTable = new cli_table3_1.default({
            head: ['记录ID', '源文件', '行号', '原始内容摘要', '错误'],
            colWidths: [14, 18, 6, 28, 24],
            wordWrap: true,
        });
        for (const record of failedRecords.slice(0, options.detail ? undefined : 10)) {
            const content = JSON.parse(record.rawContent);
            const contentSummary = Object.values(content).join(' ').substring(0, 25) + '...';
            failedTable.push([
                record.id,
                record.sourceFile,
                record.rawLineNumber.toString(),
                contentSummary,
                record.errors.join(', '),
            ]);
        }
        console.log(failedTable.toString());
        if (!options.detail && failedRecords.length > 10) {
            console.log(chalk_1.default.gray(`  还有 ${failedRecords.length - 10} 条记录，使用 --detail 查看全部`));
        }
        console.log('');
    }
    const statusCounts = {};
    for (const fact of facts) {
        statusCounts[fact.currentStatus] = (statusCounts[fact.currentStatus] || 0) + 1;
    }
    console.log(chalk_1.default.yellow('四、工单状态分布'));
    const statusTable = new cli_table3_1.default({
        head: ['状态', '数量', '占比'],
        colWidths: [20, 10, 15],
    });
    for (const [status, count] of Object.entries(statusCounts)) {
        const percentage = ((count / facts.length) * 100).toFixed(1);
        statusTable.push([status, count.toString(), `${percentage}%`]);
    }
    console.log(statusTable.toString());
    console.log('');
    console.log(chalk_1.default.yellow('五、修正建议'));
    if (failedRecords.length > 0) {
        console.log(chalk_1.default.red(`  ⚠ ${failedRecords.length} 条记录需要处理：`));
        console.log(chalk_1.default.gray('     1. 运行 pmi check --all 查看详细错误'));
        console.log(chalk_1.default.gray('     2. 修正源文件后重新导入'));
        console.log(chalk_1.default.gray('     3. 或使用 pmi fix 进行人工改判'));
    }
    else {
        console.log(chalk_1.default.green('  ✓ 无待处理错误'));
    }
    if (stats.frozenOrders > 0) {
        console.log(chalk_1.default.blue(`  ❄ ${stats.frozenOrders} 条工单已冻结，可安全导出`));
    }
    console.log('');
    console.log(chalk_1.default.gray(`报告生成时间: ${(0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss')}`));
}
//# sourceMappingURL=report.js.map