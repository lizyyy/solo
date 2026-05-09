"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewReportCommand = exports.generateReportCommand = exports.listReportsCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../storage/store");
const report_1 = require("../services/report");
const listReportsCommand = () => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    const reports = (0, store_1.getReports)();
    if (reports.length === 0) {
        console.log(chalk_1.default.yellow('暂无报告'));
        return;
    }
    console.log(chalk_1.default.blue('📄 报告列表:\n'));
    reports.forEach((r, i) => {
        console.log(chalk_1.default.white(`${i + 1}. ${r.name}`));
        console.log(chalk_1.default.gray(`   ID: ${r.id}`));
        console.log(chalk_1.default.gray(`   类型: ${r.type}`));
        console.log(chalk_1.default.gray(`   路径: ${r.filePath}`));
        console.log(chalk_1.default.gray(`   创建时间: ${r.createdAt}`));
        console.log();
    });
};
exports.listReportsCommand = listReportsCommand;
const generateReportCommand = (options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '项目未初始化');
        return;
    }
    if (!options.type) {
        console.log(chalk_1.default.red('✗ 必须指定报告类型 --type'));
        console.log(chalk_1.default.gray('   可选类型: field_missing, replay_summary, cache_summary, comprehensive'));
        (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '未指定类型');
        return;
    }
    if (!options.name) {
        console.log(chalk_1.default.red('✗ 必须指定报告名称 --name'));
        (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '未指定名称');
        return;
    }
    const validTypes = ['field_missing', 'replay_summary', 'cache_summary', 'comprehensive'];
    if (!validTypes.includes(options.type)) {
        console.log(chalk_1.default.red(`✗ 无效的报告类型: ${options.type}`));
        console.log(chalk_1.default.gray(`   可选值: ${validTypes.join(', ')}`));
        (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', `无效类型: ${options.type}`);
        return;
    }
    try {
        let content = '';
        if (options.type === 'field_missing') {
            if (!options.checkResultId) {
                console.log(chalk_1.default.red('✗ 字段缺失报告需要 --check-result-id'));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '缺少 check-result-id');
                return;
            }
            const result = (0, store_1.getCheckResultById)(options.checkResultId);
            if (!result) {
                console.log(chalk_1.default.red(`✗ 检查结果不存在: ${options.checkResultId}`));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', `检查结果不存在: ${options.checkResultId}`);
                return;
            }
            content = (0, report_1.generateFieldMissingReport)(result);
        }
        else if (options.type === 'replay_summary') {
            if (!options.replayTaskId) {
                console.log(chalk_1.default.red('✗ 回放报告需要 --replay-task-id'));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '缺少 replay-task-id');
                return;
            }
            const task = (0, store_1.getReplayTaskById)(options.replayTaskId);
            if (!task) {
                console.log(chalk_1.default.red(`✗ 回放任务不存在: ${options.replayTaskId}`));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', `回放任务不存在: ${options.replayTaskId}`);
                return;
            }
            content = (0, report_1.generateReplayReport)(task);
        }
        else if (options.type === 'cache_summary') {
            if (!options.cacheRecordId) {
                console.log(chalk_1.default.red('✗ 缓存报告需要 --cache-record-id'));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '缺少 cache-record-id');
                return;
            }
            const records = (0, store_1.getCacheRecords)();
            const record = records.find((r) => r.id === options.cacheRecordId);
            if (!record) {
                console.log(chalk_1.default.red(`✗ 缓存记录不存在: ${options.cacheRecordId}`));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', `缓存记录不存在: ${options.cacheRecordId}`);
                return;
            }
            content = (0, report_1.generateCacheReport)(record);
        }
        else if (options.type === 'comprehensive') {
            if (!options.checkResultId) {
                console.log(chalk_1.default.red('✗ 综合报告至少需要 --check-result-id'));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', '缺少 check-result-id');
                return;
            }
            const result = (0, store_1.getCheckResultById)(options.checkResultId);
            if (!result) {
                console.log(chalk_1.default.red(`✗ 检查结果不存在: ${options.checkResultId}`));
                (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', `检查结果不存在: ${options.checkResultId}`);
                return;
            }
            const taskResult = options.replayTaskId ? (0, store_1.getReplayTaskById)(options.replayTaskId) : undefined;
            const cacheRecords = (0, store_1.getCacheRecords)();
            const cacheRec = options.cacheRecordId
                ? cacheRecords.find((r) => r.id === options.cacheRecordId)
                : undefined;
            content = (0, report_1.generateComprehensiveReport)(result, taskResult ?? undefined, cacheRec);
        }
        console.log(chalk_1.default.blue('📄 正在生成报告...'));
        const report = (0, store_1.saveReport)(options.name, options.type, content, options.checkResultId, options.replayTaskId, options.cacheRecordId);
        console.log(chalk_1.default.green('✓ 报告生成成功'));
        console.log(chalk_1.default.gray(`   报告 ID: ${report.id}`));
        console.log(chalk_1.default.gray(`   报告路径: ${report.filePath}`));
        (0, store_1.addHistoryEntry)('report', `生成报告: ${options.name}`, 'success', `类型: ${options.type}, 路径: ${report.filePath}`);
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ 报告生成失败: ${e.message}`));
        (0, store_1.addHistoryEntry)('report', '生成报告失败', 'failed', e.message);
    }
};
exports.generateReportCommand = generateReportCommand;
const viewReportCommand = (reportId) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    if (!reportId) {
        console.log(chalk_1.default.red('✗ 必须指定报告 ID'));
        return;
    }
    const reports = (0, store_1.getReports)();
    const report = reports.find((r) => r.id === reportId);
    if (!report) {
        console.log(chalk_1.default.red(`✗ 报告不存在: ${reportId}`));
        console.log(chalk_1.default.gray('   可运行: sir report list 查看可用报告'));
        return;
    }
    const fs = require('fs');
    if (!fs.existsSync(report.filePath)) {
        console.log(chalk_1.default.red(`✗ 报告文件不存在: ${report.filePath}`));
        return;
    }
    console.log(chalk_1.default.blue(`📄 报告: ${report.name}`));
    console.log(chalk_1.default.gray(`路径: ${report.filePath}`));
    console.log(chalk_1.default.gray('─'.repeat(60)));
    console.log();
    const content = fs.readFileSync(report.filePath, 'utf-8');
    console.log(content);
};
exports.viewReportCommand = viewReportCommand;
//# sourceMappingURL=report.js.map