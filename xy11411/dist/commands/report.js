"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportCommand = reportCommand;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const database_1 = require("../services/database");
const stateManager_1 = require("../services/stateManager");
const fileUtils_1 = require("../utils/fileUtils");
const types_1 = require("../models/types");
async function reportCommand(options) {
    console.log(chalk_1.default.blue('\n=== 数据巡检报表 ===\n'));
    try {
        const operatorId = options.operator || 'default-admin';
        const stateManager = await (0, stateManager_1.createStateManager)(operatorId);
        let records = await database_1.dbService.getAllRecords();
        if (options.batchId) {
            records = records.filter(r => r.rawData.importBatchId === options.batchId);
        }
        if (records.length === 0) {
            console.log(chalk_1.default.yellow('没有数据记录'));
            return;
        }
        const summary = generateSummary(records, operatorId);
        const failureRecords = generateFailureRecords(records);
        if (options.failures) {
            printFailureReport(failureRecords);
        }
        else {
            printSummaryReport(summary, records);
            console.log();
            printFailureTable(failureRecords.slice(0, 10));
        }
        console.log();
        console.log(chalk_1.default.gray(`报表生成时间: ${(0, fileUtils_1.formatDate)(Date.now())}`));
        console.log(chalk_1.default.gray(`生成操作员: ${stateManager.getCurrentOperator().name}`));
        await stateManager.logAction('report_generated', 'report', undefined, {
            batchId: options.batchId,
            format: options.format || 'console',
            totalRecords: records.length,
            failureCount: failureRecords.length
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 生成报表失败:'), error.message);
        process.exit(1);
    }
}
function generateSummary(records, operatorId) {
    const bySource = {
        [types_1.DataSourceType.ORDER]: 0,
        [types_1.DataSourceType.LOSS]: 0,
        [types_1.DataSourceType.PRICE]: 0,
        [types_1.DataSourceType.PHOTO]: 0
    };
    const byStatus = {
        [types_1.RecordStatus.PENDING]: 0,
        [types_1.RecordStatus.IMPORTED]: 0,
        [types_1.RecordStatus.CHECKING]: 0,
        [types_1.RecordStatus.VALID]: 0,
        [types_1.RecordStatus.INVALID]: 0,
        [types_1.RecordStatus.FIXING]: 0,
        [types_1.RecordStatus.FIXED]: 0,
        [types_1.RecordStatus.REIMPORTED]: 0,
        [types_1.RecordStatus.EXPORTED]: 0,
        [types_1.RecordStatus.ARCHIVED]: 0
    };
    const failureReasons = {};
    let totalAmount = 0;
    let validRecords = 0;
    let invalidRecords = 0;
    let pendingRecords = 0;
    let fixedRecords = 0;
    for (const record of records) {
        bySource[record.rawData.sourceType]++;
        byStatus[record.status]++;
        if (record.status === types_1.RecordStatus.VALID || record.status === types_1.RecordStatus.EXPORTED) {
            validRecords++;
            if (record.totalAmount !== undefined) {
                totalAmount += record.totalAmount;
            }
        }
        else if (record.status === types_1.RecordStatus.INVALID) {
            invalidRecords++;
        }
        else if (record.status === types_1.RecordStatus.PENDING || record.status === types_1.RecordStatus.IMPORTED) {
            pendingRecords++;
        }
        else if (record.status === types_1.RecordStatus.FIXED) {
            fixedRecords++;
        }
        for (const check of record.checkResults) {
            if (check.status === 'fail') {
                failureReasons[check.message] = (failureReasons[check.message] || 0) + 1;
            }
        }
    }
    return {
        generatedAt: Date.now(),
        generatedBy: operatorId,
        totalRecords: records.length,
        validRecords,
        invalidRecords,
        pendingRecords,
        fixedRecords,
        totalAmount,
        bySource,
        byStatus,
        failureReasons
    };
}
function generateFailureRecords(records) {
    return records
        .filter(r => r.status === types_1.RecordStatus.INVALID)
        .map(record => {
        const failedChecks = record.checkResults.filter(c => c.status === 'fail');
        const stateChanges = record.stateChanges;
        const firstFailedAt = stateChanges.find(s => s.toStatus === types_1.RecordStatus.INVALID)?.timestamp || record.createdAt;
        const lastFailedAt = [...stateChanges].reverse().find(s => s.toStatus === types_1.RecordStatus.INVALID)?.timestamp || record.updatedAt;
        const fixAttempts = stateChanges.filter(s => s.toStatus === types_1.RecordStatus.FIXING || s.toStatus === types_1.RecordStatus.FIXED).length;
        return {
            recordId: record.id,
            originalRowNumber: record.rawData.originalRowNumber,
            sourceType: record.rawData.sourceType,
            sourceFile: record.rawData.sourceFile,
            status: record.status,
            failureReasons: failedChecks.map(c => c.message),
            firstFailedAt,
            lastFailedAt,
            fixAttempts,
            rawContent: record.rawData.rawContent
        };
    })
        .sort((a, b) => b.lastFailedAt - a.lastFailedAt);
}
function printSummaryReport(summary, records) {
    console.log(chalk_1.default.bold('📊 汇总统计'));
    console.log();
    const summaryTable = new cli_table3_1.default({
        head: ['指标', '数值'],
        colWidths: [30, 20]
    });
    summaryTable.push(['总记录数', summary.totalRecords.toString()], ['有效记录', summary.validRecords.toString()], ['无效记录', summary.invalidRecords.toString()], ['待处理记录', summary.pendingRecords.toString()], ['已修正记录', summary.fixedRecords.toString()], ['总金额', (0, fileUtils_1.formatCurrency)(summary.totalAmount)]);
    console.log(summaryTable.toString());
    console.log();
    console.log(chalk_1.default.bold('📂 按数据源分布'));
    const sourceTable = new cli_table3_1.default({
        head: ['数据源类型', '记录数', '占比'],
        colWidths: [20, 15, 15]
    });
    for (const [type, count] of Object.entries(summary.bySource)) {
        if (count > 0) {
            const percentage = ((count / summary.totalRecords) * 100).toFixed(1) + '%';
            const typeNames = {
                order: '订货表',
                loss: '损耗登记',
                price: '总部价格表',
                photo: '异常照片'
            };
            sourceTable.push([typeNames[type] || type, count.toString(), percentage]);
        }
    }
    console.log(sourceTable.toString());
    console.log();
    console.log(chalk_1.default.bold('📈 按状态分布'));
    const statusTable = new cli_table3_1.default({
        head: ['状态', '记录数'],
        colWidths: [25, 15]
    });
    const statusNames = {
        pending: '待处理',
        imported: '已导入',
        checking: '校验中',
        valid: '有效',
        invalid: '无效',
        fixing: '修正中',
        fixed: '已修正',
        reimported: '重新导入',
        exported: '已导出',
        archived: '已归档'
    };
    for (const [status, count] of Object.entries(summary.byStatus)) {
        if (count > 0) {
            statusTable.push([statusNames[status] || status, count.toString()]);
        }
    }
    console.log(statusTable.toString());
}
function printFailureTable(failures) {
    if (failures.length === 0) {
        console.log(chalk_1.default.green('✓ 没有失败的记录'));
        return;
    }
    console.log(chalk_1.default.bold('❌ 失败记录清单 (前10条)'));
    console.log();
    const table = new cli_table3_1.default({
        head: ['原始行号', '记录ID', '数据源', '失败原因', '修正次数'],
        colWidths: [12, 18, 15, 35, 12]
    });
    const typeNames = {
        order: '订货表',
        loss: '损耗登记',
        price: '价格表',
        photo: '照片'
    };
    for (const f of failures) {
        table.push([
            f.originalRowNumber.toString(),
            f.recordId.slice(0, 8),
            typeNames[f.sourceType] || f.sourceType,
            f.failureReasons.join('; ').slice(0, 30),
            f.fixAttempts.toString()
        ]);
    }
    console.log(table.toString());
}
function printFailureReport(failures) {
    console.log(chalk_1.default.bold('❌ 失败记录详细清单'));
    console.log(chalk_1.default.gray(`共 ${failures.length} 条失败记录`));
    console.log();
    const typeNames = {
        order: '订货表',
        loss: '损耗登记',
        price: '总部价格表',
        photo: '异常照片'
    };
    for (const [index, failure] of failures.entries()) {
        console.log(chalk_1.default.yellow(`[${index + 1}] 行号: ${failure.originalRowNumber} | 记录ID: ${failure.recordId}`));
        console.log(chalk_1.default.gray(`    来源文件: ${failure.sourceFile} (${typeNames[failure.sourceType] || failure.sourceType})`));
        console.log(chalk_1.default.gray(`    首次失败: ${(0, fileUtils_1.formatDate)(failure.firstFailedAt)}`));
        console.log(chalk_1.default.gray(`    最后失败: ${(0, fileUtils_1.formatDate)(failure.lastFailedAt)}`));
        console.log(chalk_1.default.gray(`    修正尝试: ${failure.fixAttempts} 次`));
        console.log(chalk_1.default.red(`    失败原因: ${failure.failureReasons.join('; ')}`));
        console.log(chalk_1.default.gray(`    原始数据: ${JSON.stringify(failure.rawContent).slice(0, 100)}...`));
        console.log();
    }
}
