"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyCommand = historyCommand;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const database_1 = require("../services/database");
const stateManager_1 = require("../services/stateManager");
const fileUtils_1 = require("../utils/fileUtils");
async function historyCommand(options) {
    console.log(chalk_1.default.blue('\n=== 历史记录查询 ===\n'));
    try {
        const operatorId = options.operator || 'default-admin';
        const stateManager = await (0, stateManager_1.createStateManager)(operatorId);
        if (options.audit) {
            await showAuditLogs(options.limit || 50);
        }
        else if (options.recordId) {
            await showRecordHistory(options.recordId);
        }
        else {
            await showRecentChanges(options.limit || 20);
        }
        await stateManager.logAction('history_query', 'system', undefined, {
            recordId: options.recordId,
            audit: options.audit || false,
            limit: options.limit || 20
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 查询失败:'), error.message);
        process.exit(1);
    }
}
async function showRecordHistory(recordId) {
    const record = await database_1.dbService.getRecordById(recordId);
    if (!record) {
        console.error(chalk_1.default.red(`✗ 记录不存在: ${recordId}`));
        process.exit(1);
    }
    console.log(chalk_1.default.bold(`📋 记录详情: ${recordId}`));
    console.log();
    console.log(chalk_1.default.gray(`物料名称: ${record.materialName || '未设置'}`));
    console.log(chalk_1.default.gray(`原始行号: ${record.rawData.originalRowNumber}`));
    console.log(chalk_1.default.gray(`来源文件: ${record.rawData.sourceFile}`));
    console.log(chalk_1.default.gray(`当前状态: ${record.status}`));
    console.log();
    const stateChanges = record.stateChanges;
    if (stateChanges.length === 0) {
        console.log(chalk_1.default.yellow('没有状态变更记录'));
        return;
    }
    console.log(chalk_1.default.bold('🔄 状态变更历史'));
    console.log();
    const table = new cli_table3_1.default({
        head: ['序号', '时间', '从状态', '到状态', '操作员', '原因'],
        colWidths: [8, 22, 15, 15, 15, 40]
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
    stateChanges.forEach((change, index) => {
        table.push([
            (index + 1).toString(),
            (0, fileUtils_1.formatDate)(change.timestamp),
            change.fromStatus ? (statusNames[change.fromStatus] || change.fromStatus) : '-',
            statusNames[change.toStatus] || change.toStatus,
            change.operator.name,
            change.reason
        ]);
    });
    console.log(table.toString());
    if (record.checkResults.length > 0) {
        console.log();
        console.log(chalk_1.default.bold('✅ 校验结果历史'));
        console.log();
        const checkTable = new cli_table3_1.default({
            head: ['检查项', '状态', '消息', '时间', '操作员'],
            colWidths: [20, 10, 40, 22, 15]
        });
        for (const check of record.checkResults) {
            const operator = await database_1.dbService.getOperatorById(check.operatorId);
            checkTable.push([
                check.checkName,
                check.status === 'pass' ? chalk_1.default.green('通过') : check.status === 'fail' ? chalk_1.default.red('失败') : chalk_1.default.yellow(check.status),
                check.message,
                (0, fileUtils_1.formatDate)(check.timestamp),
                operator?.name || check.operatorId
            ]);
        }
        console.log(checkTable.toString());
    }
}
async function showRecentChanges(limit) {
    console.log(chalk_1.default.bold(`📋 最近 ${limit} 条状态变更`));
    console.log();
    const sql = `
    SELECT 
      sc.id,
      sc.record_id,
      sc.from_status,
      sc.to_status,
      sc.operator_name,
      sc.reason,
      sc.timestamp,
      r.material_name,
      r.original_row_number
    FROM state_changes sc
    LEFT JOIN records r ON sc.record_id = r.id
    ORDER BY sc.timestamp DESC
    LIMIT ?
  `;
    const rows = await database_1.dbService.runQuery(sql, [limit]);
    if (rows.length === 0) {
        console.log(chalk_1.default.yellow('没有状态变更记录'));
        return;
    }
    const table = new cli_table3_1.default({
        head: ['时间', '记录ID', '物料', '行号', '状态变更', '操作员', '原因'],
        colWidths: [22, 18, 15, 8, 25, 12, 30]
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
    for (const row of rows) {
        const fromStatus = row.from_status ? (statusNames[row.from_status] || row.from_status) : '-';
        const toStatus = statusNames[row.to_status] || row.to_status;
        const statusChange = `${fromStatus} → ${toStatus}`;
        table.push([
            (0, fileUtils_1.formatDate)(row.timestamp),
            row.record_id.slice(0, 8),
            (row.material_name || '').slice(0, 12),
            row.original_row_number?.toString() || '-',
            statusChange,
            row.operator_name,
            row.reason.slice(0, 25)
        ]);
    }
    console.log(table.toString());
}
async function showAuditLogs(limit) {
    console.log(chalk_1.default.bold(`📋 最近 ${limit} 条审计日志`));
    console.log();
    const logs = await database_1.dbService.getAuditLogs(limit);
    if (logs.length === 0) {
        console.log(chalk_1.default.yellow('没有审计日志'));
        return;
    }
    const table = new cli_table3_1.default({
        head: ['时间', '操作', '操作员', '资源类型', '资源ID', '详情'],
        colWidths: [22, 20, 12, 15, 15, 35]
    });
    for (const log of logs) {
        let details = '';
        try {
            details = JSON.stringify(log.details).slice(0, 30);
        }
        catch {
            details = String(log.details).slice(0, 30);
        }
        table.push([
            (0, fileUtils_1.formatDate)(log.timestamp),
            log.action,
            log.operatorName,
            log.resourceType,
            log.resourceId?.slice(0, 8) || '-',
            details
        ]);
    }
    console.log(table.toString());
}
