"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryCommand = queryCommand;
exports.listBatches = listBatches;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const storage_1 = require("../storage");
const types_1 = require("../types");
function queryCommand(options) {
    const queryOptions = {};
    if (options.batch)
        queryOptions.batchId = options.batch;
    if (options.status)
        queryOptions.status = options.status;
    if (options.abnormal)
        queryOptions.abnormalType = options.abnormal;
    if (options.start)
        queryOptions.startDate = options.start;
    if (options.end)
        queryOptions.endDate = options.end;
    if (options.keyword)
        queryOptions.keyword = options.keyword;
    const records = storage_1.Storage.queryRecords(queryOptions);
    const batches = storage_1.Storage.getAllBatches();
    console.log(chalk_1.default.blue.bold(`\n查询结果: 共 ${records.length} 条记录\n`));
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.cyan('ID'),
            chalk_1.default.cyan('批次号'),
            chalk_1.default.cyan('客户姓名'),
            chalk_1.default.cyan('客服'),
            chalk_1.default.cyan('状态'),
            chalk_1.default.cyan('异常类型'),
            chalk_1.default.cyan('摘要')
        ],
        colWidths: [12, 15, 12, 10, 12, 14, 30],
        wordWrap: true
    });
    records.forEach(record => {
        const statusColor = record.status === types_1.ProcessingStatus.SUCCESS ? chalk_1.default.green :
            record.status === types_1.ProcessingStatus.ABNORMAL ? chalk_1.default.red :
                record.status === types_1.ProcessingStatus.MANUALLY_CORRECTED ? chalk_1.default.yellow :
                    chalk_1.default.gray;
        table.push([
            record.id.substring(0, 8),
            record.batchId,
            record.customerName,
            record.agentName,
            statusColor(record.status),
            record.abnormalType ? chalk_1.default.magenta(record.abnormalType) : '-',
            record.summary.substring(0, 25) + (record.summary.length > 25 ? '...' : '')
        ]);
    });
    console.log(table.toString());
    const stats = batches.filter(b => queryOptions.batchId ? b.batchId === queryOptions.batchId : true);
    console.log(chalk_1.default.blue.bold('\n批次统计:'));
    stats.forEach(batch => {
        console.log(chalk_1.default.white(`\n批次 ${chalk_1.default.bold(batch.batchId)} (${batch.batchName}):`));
        console.log(`  来源: ${batch.source}`);
        console.log(`  处理依据: ${batch.processingBasis}`);
        console.log(`  总计: ${batch.totalRecords}, 成功: ${chalk_1.default.green(batch.successCount)}, 异常: ${chalk_1.default.red(batch.abnormalCount)}, 待处理: ${chalk_1.default.yellow(batch.pendingCount)}, 已修正: ${chalk_1.default.cyan(batch.correctedCount)}`);
    });
}
function listBatches() {
    const batches = storage_1.Storage.getAllBatches();
    console.log(chalk_1.default.blue.bold('\n批次列表:\n'));
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.cyan('批次号'),
            chalk_1.default.cyan('批次名称'),
            chalk_1.default.cyan('来源'),
            chalk_1.default.cyan('总计'),
            chalk_1.default.cyan('成功'),
            chalk_1.default.cyan('异常'),
            chalk_1.default.cyan('待处理'),
            chalk_1.default.cyan('已修正')
        ]
    });
    batches.forEach(batch => {
        table.push([
            batch.batchId,
            batch.batchName,
            batch.source,
            batch.totalRecords,
            chalk_1.default.green(batch.successCount),
            chalk_1.default.red(batch.abnormalCount),
            chalk_1.default.yellow(batch.pendingCount),
            chalk_1.default.cyan(batch.correctedCount)
        ]);
    });
    console.log(table.toString());
}
