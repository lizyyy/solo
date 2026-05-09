"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCachesCommand = exports.listReplaysCommand = exports.listChecksCommand = exports.historyCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const moment_1 = __importDefault(require("moment"));
const store_1 = require("../storage/store");
const formatDate = (iso) => {
    return (0, moment_1.default)(iso).format('YYYY-MM-DD HH:mm:ss');
};
const historyCommand = (options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        return;
    }
    const limit = options.limit || 20;
    const entries = (0, store_1.getHistory)(limit, options.type);
    if (entries.length === 0) {
        console.log(chalk_1.default.yellow('暂无历史记录'));
        return;
    }
    console.log(chalk_1.default.blue(`📜 操作历史 (最近 ${entries.length} 条):\n`));
    entries.forEach((entry, index) => {
        const statusColor = entry.status === 'success' ? chalk_1.default.green : chalk_1.default.red;
        const typeEmoji = {
            init: '🏗️',
            import: '📥',
            check: '🔍',
            replay: '🔄',
            cache: '🗄️',
            report: '📄',
        };
        console.log(chalk_1.default.white(`${index + 1}. ${typeEmoji[entry.type] || '📌'} [${entry.type.toUpperCase()}] ${entry.action}`));
        console.log(chalk_1.default.gray(`   时间: ${formatDate(entry.timestamp)}`));
        console.log(chalk_1.default.gray(`   状态: ${statusColor(entry.status)}`));
        console.log(chalk_1.default.gray(`   详情: ${entry.details}`));
        console.log();
    });
};
exports.historyCommand = historyCommand;
const listChecksCommand = () => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    const results = (0, store_1.getCheckResults)();
    if (results.length === 0) {
        console.log(chalk_1.default.yellow('暂无检查结果'));
        return;
    }
    console.log(chalk_1.default.blue('📋 检查结果列表:\n'));
    results.forEach((r, i) => {
        const issueRate = ((r.summary.withIssues / r.summary.totalChecked) * 100).toFixed(1);
        const hasIssues = r.summary.withIssues > 0;
        console.log(chalk_1.default.white(`${i + 1}. 检查结果 #${r.id.slice(0, 8)}`));
        console.log(chalk_1.default.gray(`   完整 ID: ${r.id}`));
        console.log(chalk_1.default.gray(`   检查时间: ${formatDate(r.timestamp)}`));
        console.log(chalk_1.default.gray(`   商品: ${r.summary.totalChecked} | 问题: ${hasIssues ? chalk_1.default.yellow(r.summary.withIssues) : r.summary.withIssues} (${issueRate}%)`));
        console.log(chalk_1.default.gray(`   缺失字段: ${r.summary.missingFieldsTotal} | 不一致: ${r.summary.mismatchedFieldsTotal}`));
        console.log();
    });
};
exports.listChecksCommand = listChecksCommand;
const listReplaysCommand = () => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    const tasks = (0, store_1.getReplayTasks)();
    if (tasks.length === 0) {
        console.log(chalk_1.default.yellow('暂无回放任务'));
        return;
    }
    console.log(chalk_1.default.blue('🔄 回放任务列表:\n'));
    tasks.forEach((t, i) => {
        const statusColor = {
            pending: chalk_1.default.blue,
            running: chalk_1.default.yellow,
            completed: chalk_1.default.green,
            failed: chalk_1.default.red,
        };
        console.log(chalk_1.default.white(`${i + 1}. ${t.name}`));
        console.log(chalk_1.default.gray(`   ID: ${t.id}`));
        console.log(chalk_1.default.gray(`   状态: ${statusColor[t.status](t.status)}`));
        console.log(chalk_1.default.gray(`   商品数: ${t.productIds.length}`));
        console.log(chalk_1.default.gray(`   成功: ${t.successCount} | 失败: ${t.failedCount}`));
        if (t.startTime) {
            console.log(chalk_1.default.gray(`   开始: ${formatDate(t.startTime)}`));
        }
        if (t.endTime) {
            console.log(chalk_1.default.gray(`   结束: ${formatDate(t.endTime)}`));
        }
        console.log();
    });
};
exports.listReplaysCommand = listReplaysCommand;
const listCachesCommand = () => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    const records = (0, store_1.getCacheRecords)();
    if (records.length === 0) {
        console.log(chalk_1.default.yellow('暂无缓存刷新记录'));
        return;
    }
    console.log(chalk_1.default.blue('🗄️ 缓存刷新记录:\n'));
    records.forEach((r, i) => {
        const statusColor = {
            success: chalk_1.default.green,
            failed: chalk_1.default.red,
            partial: chalk_1.default.yellow,
        };
        console.log(chalk_1.default.white(`${i + 1}. 刷新记录 #${r.id.slice(0, 8)}`));
        console.log(chalk_1.default.gray(`   完整 ID: ${r.id}`));
        console.log(chalk_1.default.gray(`   时间: ${formatDate(r.timestamp)}`));
        console.log(chalk_1.default.gray(`   状态: ${statusColor[r.status](r.status)}`));
        console.log(chalk_1.default.gray(`   成功: ${r.refreshedCount} | 失败: ${r.failedCount} | 总数: ${r.productIds.length}`));
        console.log();
    });
};
exports.listCachesCommand = listCachesCommand;
//# sourceMappingURL=history.js.map