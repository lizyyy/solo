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
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
class ReportGenerator {
    constructor(outputDir, logger) {
        this.outputDir = outputDir;
        this.logger = logger;
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    generate(result, inputFile) {
        const timestamp = (0, dayjs_1.default)().format('YYYYMMDD_HHmmss');
        const files = [];
        const summaryPath = this.generateSummaryReport(result, timestamp, inputFile);
        files.push({ path: summaryPath, description: '排查总览报告：包含所有检查项的统计摘要和关键问题概览' });
        const conflictPath = this.generateConflictReport(result, timestamp);
        files.push({ path: conflictPath, description: '窗口冲突详情报告：包含时间窗口重叠的任务对，及原始文件位置信息' });
        const delayPath = this.generateDelayReport(result, timestamp);
        files.push({ path: delayPath, description: '任务拖延详情报告：包含超过阈值未开始的任务列表' });
        const crossDayPath = this.generateCrossDayReport(result, timestamp);
        files.push({ path: crossDayPath, description: '跨天窗口报告：包含运行时间跨天的任务，需重点关注' });
        const retryPath = this.generateRetryReport(result, timestamp);
        files.push({ path: retryPath, description: '失败重试报告：包含正在重试的失败任务及重试次数' });
        const largePath = this.generateLargeIndexReport(result, timestamp);
        files.push({ path: largePath, description: '大索引并发报告：包含同时运行的大索引任务列表' });
        const summary = {
            totalTasks: result.windowConflicts.length > 0 ?
                new Set([...result.windowConflicts.flatMap(c => [c.task1.id, c.task2.id]), ...result.taskDelays.map(d => d.task.id), ...result.crossDayWindows.map(t => t.id), ...result.failedRetries.map(t => t.id), ...result.largeIndexConcurrent.map(t => t.id)]).size : 0,
            conflictCount: result.windowConflicts.length,
            delayCount: result.taskDelays.length,
            crossDayCount: result.crossDayWindows.length,
            failedRetryCount: result.failedRetries.length,
            largeConcurrentCount: result.largeIndexConcurrent.length,
            files
        };
        this.generateFinalSummary(summary, timestamp);
        this.logger.info('报告生成完成', { fileCount: files.length });
        return summary;
    }
    generateSummaryReport(result, timestamp, inputFile) {
        const filePath = path.join(this.outputDir, `search_index_check_summary_${timestamp}.md`);
        const content = `# 搜索索引任务重建窗口排查报告

> 生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}  
> 输入文件: ${inputFile}

## 检查结果总览

| 检查项 | 数量 | 说明 |
|--------|------|------|
| 窗口冲突 | ${result.windowConflicts.length} | 时间窗口重叠的任务对数 |
| 任务拖延 | ${result.taskDelays.length} | 超过30分钟未开始的任务数 |
| 跨天窗口 | ${result.crossDayWindows.length} | 运行时间跨天的任务数 |
| 失败重试 | ${result.failedRetries.length} | 正在重试的失败任务数 |
| 大索引并发 | ${result.largeIndexConcurrent.length} | 同时运行的大索引任务数 |

## 关键问题

${this.renderKeyIssues(result)}

## 退出码说明

- **0**: 检查通过，无异常
- **1**: 存在窗口冲突
- **2**: 存在任务拖延
- **3**: 存在跨天窗口
- **4**: 存在失败重试任务
- **5**: 存在大索引并发
- **多个问题**: 各退出码相加

---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
`;
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    renderKeyIssues(result) {
        const issues = [];
        if (result.windowConflicts.length > 0) {
            issues.push(`⚠️ **窗口冲突**: 发现 ${result.windowConflicts.length} 对任务存在时间窗口重叠，可能导致资源竞争`);
        }
        if (result.taskDelays.length > 0) {
            issues.push(`⚠️ **任务拖延**: 发现 ${result.taskDelays.length} 个任务拖延超过30分钟未开始`);
        }
        if (result.crossDayWindows.length > 0) {
            issues.push(`⚠️ **跨天窗口**: 发现 ${result.crossDayWindows.length} 个任务运行时间跨天，建议检查是否异常`);
        }
        if (result.failedRetries.length > 0) {
            issues.push(`⚠️ **失败重试**: 发现 ${result.failedRetries.length} 个任务正在重试，需关注最终状态`);
        }
        if (result.largeIndexConcurrent.length > 0) {
            issues.push(`⚠️ **大索引并发**: 发现 ${result.largeIndexConcurrent.length} 个大索引任务并发运行，可能影响性能`);
        }
        if (issues.length === 0) {
            return '✅ **全部通过**: 未发现任何异常问题';
        }
        return issues.join('\n\n');
    }
    generateConflictReport(result, timestamp) {
        const filePath = path.join(this.outputDir, `search_index_window_conflicts_${timestamp}.md`);
        const content = `# 搜索索引任务 - 窗口冲突详情报告

> 生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}

## 冲突列表 (共 ${result.windowConflicts.length} 项)

${result.windowConflicts.length === 0 ? '✅ 无窗口冲突' : result.windowConflicts.map((conflict, index) => `
### 冲突 #${index + 1}

**冲突类型**: ${conflict.type === 'overlap' ? '时间窗口重叠' : conflict.type}

**任务 1**:
- 任务ID: ${conflict.task1.id}
- 索引名称: ${conflict.task1.indexName}
- 分片ID: ${conflict.task1.shardId}
- 时间窗口: ${conflict.task1.startTime} ~ ${conflict.task1.endTime}
- 状态: ${conflict.task1.status}
- 原始位置: \`${conflict.task1.sourceFile}:${conflict.task1.sourceLine}\`

**任务 2**:
- 任务ID: ${conflict.task2.id}
- 索引名称: ${conflict.task2.indexName}
- 分片ID: ${conflict.task2.shardId}
- 时间窗口: ${conflict.task2.startTime} ~ ${conflict.task2.endTime}
- 状态: ${conflict.task2.status}
- 原始位置: \`${conflict.task2.sourceFile}:${conflict.task2.sourceLine}\`

**描述**: ${conflict.description}

---
`).join('')}

---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
`;
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateDelayReport(result, timestamp) {
        const filePath = path.join(this.outputDir, `search_index_task_delays_${timestamp}.md`);
        const content = `# 搜索索引任务 - 任务拖延详情报告

> 生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}

## 拖延任务列表 (共 ${result.taskDelays.length} 项)

${result.taskDelays.length === 0 ? '✅ 无任务拖延' : `

| # | 任务ID | 索引名称 | 预期开始时间 | 拖延时间(分钟) | 原始位置 | 描述 |
|---|--------|----------|--------------|----------------|----------|------|
${result.taskDelays.map((delay, index) => `| ${index + 1} | ${delay.task.id} | ${delay.task.indexName} | ${delay.expectedStartTime} | ${delay.delayMinutes} | \`${delay.task.sourceFile}:${delay.task.sourceLine}\` | ${delay.description} |`).join('\n')}

`}

---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
`;
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateCrossDayReport(result, timestamp) {
        const filePath = path.join(this.outputDir, `search_index_cross_day_${timestamp}.md`);
        const content = `# 搜索索引任务 - 跨天窗口报告

> 生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}

## 跨天任务列表 (共 ${result.crossDayWindows.length} 项)

${result.crossDayWindows.length === 0 ? '✅ 无跨天窗口任务' : `

| # | 任务ID | 索引名称 | 分片ID | 开始时间 | 结束时间 | 状态 | 原始位置 |
|---|--------|----------|--------|----------|----------|------|----------|
${result.crossDayWindows.map((task, index) => `| ${index + 1} | ${task.id} | ${task.indexName} | ${task.shardId} | ${task.startTime} | ${task.endTime} | ${task.status} | \`${task.sourceFile}:${task.sourceLine}\` |`).join('\n')}

`}

---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
`;
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateRetryReport(result, timestamp) {
        const filePath = path.join(this.outputDir, `search_index_failed_retries_${timestamp}.md`);
        const content = `# 搜索索引任务 - 失败重试报告

> 生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}

## 重试任务列表 (共 ${result.failedRetries.length} 项)

${result.failedRetries.length === 0 ? '✅ 无失败重试任务' : `

| # | 任务ID | 索引名称 | 分片ID | 重试次数 | 状态 | 原始位置 |
|---|--------|----------|--------|----------|------|----------|
${result.failedRetries.map((task, index) => `| ${index + 1} | ${task.id} | ${task.indexName} | ${task.shardId} | ${task.retryCount} | ${task.status} | \`${task.sourceFile}:${task.sourceLine}\` |`).join('\n')}

`}

---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
`;
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateLargeIndexReport(result, timestamp) {
        const filePath = path.join(this.outputDir, `search_index_large_concurrent_${timestamp}.md`);
        const content = `# 搜索索引任务 - 大索引并发报告

> 生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}

## 并发任务列表 (共 ${result.largeIndexConcurrent.length} 项)

${result.largeIndexConcurrent.length === 0 ? '✅ 无大索引并发任务' : `

| # | 任务ID | 索引名称 | 分片ID | 时间窗口 | 状态 | 原始位置 |
|---|--------|----------|--------|----------|------|----------|
${result.largeIndexConcurrent.map((task, index) => `| ${index + 1} | ${task.id} | ${task.indexName} | ${task.shardId} | ${task.startTime} ~ ${task.endTime} | ${task.status} | \`${task.sourceFile}:${task.sourceLine}\` |`).join('\n')}

`}

---

*本报告由搜索索引任务重建窗口排查 CLI 自动生成*
`;
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateFinalSummary(summary, timestamp) {
        const filePath = path.join(this.outputDir, `search_index_check_report_${timestamp}.json`);
        const jsonReport = {
            reportName: '搜索索引任务重建窗口排查报告',
            generatedAt: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss'),
            summary: {
                totalTasks: summary.totalTasks,
                conflictCount: summary.conflictCount,
                delayCount: summary.delayCount,
                crossDayCount: summary.crossDayCount,
                failedRetryCount: summary.failedRetryCount,
                largeConcurrentCount: summary.largeConcurrentCount,
                exitCode: this.calculateExitCode(summary)
            },
            files: summary.files.map(f => ({
                fileName: path.basename(f.path),
                description: f.description
            }))
        };
        fs.writeFileSync(filePath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    }
    calculateExitCode(summary) {
        let exitCode = 0;
        if (summary.conflictCount > 0)
            exitCode += 1;
        if (summary.delayCount > 0)
            exitCode += 2;
        if (summary.crossDayCount > 0)
            exitCode += 4;
        if (summary.failedRetryCount > 0)
            exitCode += 8;
        if (summary.largeConcurrentCount > 0)
            exitCode += 16;
        return exitCode;
    }
}
exports.ReportGenerator = ReportGenerator;
