"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyCommand = historyCommand;
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const moment_1 = __importDefault(require("moment"));
const database_1 = require("../database");
async function historyCommand(workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    if (options.batch) {
        await showBatchDetail(db, options.batch);
        return;
    }
    const history = await db.getImportHistory(options.limit || 50);
    console.log(chalk_1.default.blue('导入历史记录'));
    console.log('');
    if (history.length === 0) {
        console.log(chalk_1.default.gray('暂无导入记录'));
        return;
    }
    const table = new cli_table3_1.default({
        head: ['批次号', '源文件', '类型', '总数', '已处理', '状态', '时间'],
        colWidths: [12, 22, 12, 8, 10, 10, 20],
    });
    for (const session of history) {
        const statusColor = session.status === 'completed' ? chalk_1.default.green : chalk_1.default.red;
        table.push([
            session.batchId,
            session.sourceFile,
            session.sourceType,
            session.totalRecords.toString(),
            session.processedRecords.toString(),
            statusColor(session.status),
            (0, moment_1.default)(session.startedAt).format('YYYY-MM-DD HH:mm'),
        ]);
    }
    console.log(table.toString());
    console.log('');
    console.log(chalk_1.default.gray(`使用 pmi history --batch <批次号> 查看批次详情`));
}
async function showBatchDetail(db, batchId) {
    const session = await db.getSessionById(batchId);
    if (!session) {
        console.log(chalk_1.default.red(`批次 ${batchId} 不存在`));
        return;
    }
    console.log(chalk_1.default.blue(`批次详情: ${batchId}`));
    console.log('');
    const infoTable = new cli_table3_1.default({
        colWidths: [20, 60],
    });
    infoTable.push(['批次号', session.batchId], ['源文件', session.sourceFile], ['数据类型', session.sourceType], ['状态', session.status], ['总记录数', session.totalRecords.toString()], ['已处理', session.processedRecords.toString()], ['开始时间', (0, moment_1.default)(session.startedAt).format('YYYY-MM-DD HH:mm:ss')], ['完成时间', session.completedAt ? (0, moment_1.default)(session.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-']);
    console.log(infoTable.toString());
    console.log('');
    const records = await db.getRawRecordsByBatch(batchId);
    console.log(chalk_1.default.yellow(`记录列表 (${records.length} 条):`));
    const recordsTable = new cli_table3_1.default({
        head: ['记录ID', '行号', '状态', '内容摘要'],
        colWidths: [14, 8, 12, 56],
        wordWrap: true,
    });
    for (const record of records) {
        const content = JSON.parse(record.rawContent);
        const contentSummary = Object.values(content).join(' ').substring(0, 50);
        const statusColor = getStatusColor(record.status);
        recordsTable.push([
            record.id,
            record.rawLineNumber.toString(),
            statusColor(record.status),
            contentSummary,
        ]);
    }
    console.log(recordsTable.toString());
}
function getStatusColor(status) {
    switch (status) {
        case 'imported':
            return chalk_1.default.green;
        case 'failed':
            return chalk_1.default.red;
        case 'fixed':
            return chalk_1.default.blue;
        case 'withdrawn':
            return chalk_1.default.gray;
        case 'pending':
            return chalk_1.default.yellow;
        default:
            return chalk_1.default.white;
    }
}
//# sourceMappingURL=history.js.map