#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../store");
const group_signup_1 = require("../importers/group-signup");
const contract_screenshot_1 = require("../importers/contract-screenshot");
const reconciliation_1 = require("../core/reconciliation");
const exporters_1 = require("../exporters");
const path = __importStar(require("path"));
const program = new commander_1.Command();
program
    .name('amdc')
    .description('音频母带交付核对系统')
    .version('1.0.0');
program
    .command('import-group')
    .description('导入排练群接龙文件')
    .argument('<file>', '接龙文件路径 (CSV/XLSX/TXT)')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-d, --data <file>', '数据文件路径')
    .action((file, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = (0, group_signup_1.importGroupSignupFile)(store, path.resolve(file), options.operator);
        console.log(chalk_1.default.green('✓ 导入成功'));
        console.log('  批次ID: ' + chalk_1.default.cyan(result.batchId));
        console.log('  记录数: ' + chalk_1.default.cyan(String(result.recordCount)));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 导入失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('import-contract')
    .description('导入合同页截图提取文件')
    .argument('<file>', '合同文件路径 (CSV/XLSX/TXT)')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-l, --late', '晚到材料，仅刷新相关明细')
    .option('-d, --data <file>', '数据文件路径')
    .action((file, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = (0, contract_screenshot_1.importContractFile)(store, path.resolve(file), options.operator, options.late);
        const suffix = options.late ? ' (晚到材料模式)' : '';
        console.log(chalk_1.default.green('✓ 导入成功' + suffix));
        console.log('  批次ID: ' + chalk_1.default.cyan(result.batchId));
        console.log('  记录数: ' + chalk_1.default.cyan(String(result.recordCount)));
        if (options.late) {
            console.log(chalk_1.default.yellow('  提示: 请运行 amdc reconcile --late ' + result.batchId + ' 进行增量核对'));
        }
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 导入失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('reconcile')
    .description('执行核对')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-l, --late <batchId>', '晚到合同批次ID，仅增量核对')
    .option('-f, --force', '不保留已确认内容，全量重新核对')
    .option('-d, --data <file>', '数据文件路径')
    .action((options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = (0, reconciliation_1.runReconciliation)(store, options.operator, {
            lateContractBatchId: options.late,
            preserveConfirmed: !options.force
        });
        console.log(chalk_1.default.green('✓ 核对完成'));
        console.log('  新增: ' + chalk_1.default.cyan(String(result.created)));
        console.log('  更新: ' + chalk_1.default.cyan(String(result.updated)));
        console.log('  跳过(已确认): ' + chalk_1.default.cyan(String(result.skipped)));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 核对失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('confirm')
    .description('确认一条核对结果')
    .argument('<resultId>', '结果ID')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-n, --notes <text>', '复核备注')
    .option('-d, --data <file>', '数据文件路径')
    .action((resultId, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = (0, reconciliation_1.confirmResult)(store, resultId, options.operator, options.notes);
        if (!result) {
            console.error(chalk_1.default.red('✗ 未找到结果: ' + resultId));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✓ 已确认'));
        console.log('  表演者: ' + chalk_1.default.cyan(result.matchedPerformerName || ''));
        console.log('  曲目: ' + chalk_1.default.cyan(result.matchedSongName || ''));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 确认失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('reject')
    .description('驳回一条核对结果')
    .argument('<resultId>', '结果ID')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-n, --notes <text>', '驳回原因')
    .option('-d, --data <file>', '数据文件路径')
    .action((resultId, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = (0, reconciliation_1.rejectResult)(store, resultId, options.operator, options.notes);
        if (!result) {
            console.error(chalk_1.default.red('✗ 未找到结果: ' + resultId));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✓ 已驳回'));
        console.log('  表演者: ' + chalk_1.default.cyan(result.matchedPerformerName || ''));
        console.log('  曲目: ' + chalk_1.default.cyan(result.matchedSongName || ''));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 驳回失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('rollback')
    .description('回滚一条核对结果（取消确认/驳回）')
    .argument('<resultId>', '结果ID')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-r, --reason <text>', '回滚原因')
    .option('-d, --data <file>', '数据文件路径')
    .action((resultId, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = (0, reconciliation_1.rollbackResult)(store, resultId, options.operator, options.reason);
        if (!result) {
            console.error(chalk_1.default.red('✗ 未找到结果: ' + resultId));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✓ 已回滚'));
        console.log('  当前状态: ' + chalk_1.default.cyan(result.status));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 回滚失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('export')
    .description('导出核对明细')
    .argument('<output>', '输出文件路径 (.xlsx)')
    .option('-d, --data <file>', '数据文件路径')
    .action((output, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const outPath = path.resolve(output);
        (0, exporters_1.exportResultsToExcel)(store, outPath);
        console.log(chalk_1.default.green('✓ 导出成功'));
        console.log('  文件: ' + chalk_1.default.cyan(outPath));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 导出失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('export-log')
    .description('导出操作日志（复盘用）')
    .argument('<output>', '输出文件路径 (.xlsx)')
    .option('-d, --data <file>', '数据文件路径')
    .action((output, options) => {
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const outPath = path.resolve(output);
        (0, exporters_1.exportAuditLogToExcel)(store, outPath);
        console.log(chalk_1.default.green('✓ 日志导出成功'));
        console.log('  文件: ' + chalk_1.default.cyan(outPath));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 导出失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('status')
    .description('查看当前状态统计')
    .option('-d, --data <file>', '数据文件路径')
    .action((options) => {
    const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
    const state = store.getState();
    const details = store.getResultsWithDetails();
    console.log(chalk_1.default.bold('当前状态'));
    console.log('  接龙记录: ' + chalk_1.default.cyan(String(state.groupRecords.length)));
    console.log('  合同记录: ' + chalk_1.default.cyan(String(state.contractRecords.length)));
    console.log('  核对结果: ' + chalk_1.default.cyan(String(details.length)));
    console.log('  操作日志: ' + chalk_1.default.cyan(String(state.logs.length)));
    console.log('  导入批次: ' + chalk_1.default.cyan(String(state.batches.length)));
    console.log('  最后更新: ' + chalk_1.default.gray(state.lastUpdated));
    const byStatus = {};
    for (const d of details) {
        byStatus[d.result.status] = (byStatus[d.result.status] || 0) + 1;
    }
    console.log('');
    console.log(chalk_1.default.bold('按状态统计'));
    for (const [status, count] of Object.entries(byStatus)) {
        console.log('  ' + status + ': ' + chalk_1.default.cyan(String(count)));
    }
});
program
    .command('list')
    .description('列出核对结果')
    .option('-s, --status <status>', '按状态筛选')
    .option('-d, --data <file>', '数据文件路径')
    .action((options) => {
    const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
    const details = store.getResultsWithDetails();
    const filtered = options.status
        ? details.filter((d) => d.result.status === options.status)
        : details;
    console.log(chalk_1.default.bold('核对结果 (' + filtered.length + ' 条)'));
    console.log('');
    for (const { result, groupRecord, contractRecord } of filtered) {
        let statusColor;
        if (result.status === 'confirmed') {
            statusColor = chalk_1.default.green;
        }
        else if (result.status === 'needs_review') {
            statusColor = chalk_1.default.yellow;
        }
        else if (result.status === 'rejected') {
            statusColor = chalk_1.default.red;
        }
        else {
            statusColor = chalk_1.default.gray;
        }
        const statusStr = '[' + result.status + ']';
        const idPart = statusColor(result.id);
        const statusPart = statusColor(statusStr).padEnd(20);
        const namePart = chalk_1.default.bold(result.matchedPerformerName || '(未知)');
        const songPart = result.matchedSongName || '(未知)';
        console.log(idPart + '  ' + statusPart + ' ' + namePart + ' - ' + songPart);
        if (result.reviewReasons.length > 0) {
            console.log('  原因: ' + chalk_1.default.yellow(result.reviewReasons.join(', ')));
        }
        if (groupRecord) {
            const preview = groupRecord.rawContent.substring(0, 50);
            console.log('  接龙行 #' + groupRecord.originalRowNumber + ': ' + chalk_1.default.gray(preview));
        }
        if (contractRecord) {
            const preview = contractRecord.rawContent.substring(0, 50);
            console.log('  合同: ' + chalk_1.default.gray(preview));
        }
        console.log('');
    }
});
program
    .command('batches')
    .description('列出所有导入批次')
    .option('-d, --data <file>', '数据文件路径')
    .action((options) => {
    const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
    const state = store.getState();
    console.log(chalk_1.default.bold('导入批次 (' + state.batches.length + ')'));
    for (const batch of state.batches.slice().reverse()) {
        const isSuperseded = batch.status === 'superseded';
        const statusLabel = isSuperseded ? chalk_1.default.gray(' [已回滚]') : '';
        console.log('  ' + chalk_1.default.cyan(batch.id) + statusLabel);
        console.log('    来源: ' + batch.source + '  文件: ' + batch.fileName);
        console.log('    记录数: ' + batch.recordCount + '  操作人: ' + batch.operator + '  时间: ' + batch.importedAt);
        console.log('');
    }
});
program
    .command('rollback-batch')
    .description('回滚一个导入批次（软删除，保留痕迹）')
    .argument('<batchId>', '批次ID')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-r, --reason <text>', '回滚原因')
    .option('-f, --force', '确认执行')
    .option('-d, --data <file>', '数据文件路径')
    .action((batchId, options) => {
    if (!options.force) {
        console.error(chalk_1.default.yellow('警告：此操作会标记该批次所有相关记录为已替换，相关核对结果也会被标记。'));
        console.error(chalk_1.default.yellow('       请加 --force 确认执行。操作痕迹会保留在日志中，可用于复盘。'));
        process.exit(1);
    }
    try {
        const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
        const result = store.rollbackBatch(batchId, options.operator, options.reason);
        console.log(chalk_1.default.green('✓ 批次已回滚'));
        console.log('  接龙记录: ' + chalk_1.default.cyan(String(result.affectedGroupRecords)));
        console.log('  合同记录: ' + chalk_1.default.cyan(String(result.affectedContractRecords)));
        console.log('  核对结果: ' + chalk_1.default.cyan(String(result.affectedResults)));
    }
    catch (e) {
        console.error(chalk_1.default.red('✗ 回滚失败: ' + e.message));
        process.exit(1);
    }
});
program
    .command('reset')
    .description('重置所有数据（危险操作）')
    .option('-o, --operator <name>', '操作人', 'system')
    .option('-f, --force', '确认执行')
    .option('-d, --data <file>', '数据文件路径')
    .action((options) => {
    if (!options.force) {
        console.error(chalk_1.default.red('✗ 此操作会删除所有数据，请加 --force 确认'));
        process.exit(1);
    }
    const store = options.data ? new store_1.ReconciliationStore(path.resolve(options.data)) : store_1.defaultStore;
    store.resetState(options.operator);
    console.log(chalk_1.default.green('✓ 数据已重置'));
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map