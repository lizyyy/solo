"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = exports.ExportService = void 0;
const csv_writer_1 = require("csv-writer");
const CancelRequestStore_1 = require("../store/CancelRequestStore");
class ExportService {
    constructor() {
        this.store = CancelRequestStore_1.cancelRequestStore;
    }
    async exportReport(requestId, reportId, format = 'json') {
        const request = await this.store.getById(requestId);
        if (!request) {
            return undefined;
        }
        const report = request.reports.find(r => r.reportId === reportId);
        if (!report) {
            return undefined;
        }
        switch (format) {
            case 'json':
                return this.exportToJson(report);
            case 'csv':
                return this.exportToCsv(report, request);
            default:
                return this.exportToJson(report);
        }
    }
    async exportFullRequest(requestId, format = 'json') {
        const request = await this.store.getById(requestId);
        if (!request) {
            return undefined;
        }
        switch (format) {
            case 'json':
                return JSON.stringify(this.serializeDate(request), null, 2);
            case 'csv':
                return this.exportFullRequestToCsv(request);
            default:
                return JSON.stringify(this.serializeDate(request), null, 2);
        }
    }
    exportToJson(report) {
        return JSON.stringify(this.serializeDate(report), null, 2);
    }
    exportToCsv(report, request) {
        const header = [
            { id: 'taskId', title: '任务ID' },
            { id: 'taskName', title: '任务名称' },
            { id: 'originalStatus', title: '原始状态' },
            { id: 'finalStatus', title: '最终状态' },
            { id: 'action', title: '操作' },
            { id: 'reason', title: '原因' }
        ];
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({ header });
        const summary = [
            `# 撤销报告: ${report.reportId}`,
            `# 作业ID: ${request.jobId}`,
            `# 作业名称: ${request.jobName}`,
            `# 生成时间: ${report.generatedAt.toISOString()}`,
            `# 总任务数: ${report.totalTasks}`,
            `# 已拦截: ${report.interceptedTasks}`,
            `# 已撤销: ${report.canceledTasks}`,
            `# 已保护: ${report.protectedTasks}`,
            `# 失败任务: ${report.failedTasks}`,
            `# 摘要: ${report.summary}`,
            ''
        ].join('\n');
        const records = report.details.map(d => ({
            taskId: d.taskId,
            taskName: d.taskName,
            originalStatus: d.originalStatus,
            finalStatus: d.finalStatus,
            action: d.action,
            reason: d.reason
        }));
        const headerString = csvStringifier.getHeaderString();
        return summary + (headerString || '') + csvStringifier.stringifyRecords(records);
    }
    exportFullRequestToCsv(request) {
        const parts = [];
        parts.push('# 撤销请求完整导出');
        parts.push(`# 请求ID: ${request.requestId}`);
        parts.push(`# 作业ID: ${request.jobId}`);
        parts.push(`# 作业名称: ${request.jobName}`);
        parts.push(`# 当前状态: ${request.status}`);
        parts.push(`# 创建时间: ${request.createdAt.toISOString()}`);
        parts.push(`# 更新时间: ${request.updatedAt.toISOString()}`);
        parts.push(`# 结果保留策略: ${request.retainResultPolicy}`);
        parts.push('');
        parts.push('## 撤销原因记录');
        const reasonHeader = [
            { id: 'code', title: '原因代码' },
            { id: 'message', title: '原因描述' },
            { id: 'operator', title: '操作员' },
            { id: 'operatedAt', title: '操作时间' },
            { id: 'evidence', title: '证据' }
        ];
        const reasonStringifier = (0, csv_writer_1.createObjectCsvStringifier)({ header: reasonHeader });
        const reasonHeaderStr = reasonStringifier.getHeaderString();
        if (reasonHeaderStr) {
            parts.push(reasonHeaderStr);
        }
        parts.push(reasonStringifier.stringifyRecords(request.reasons.map(r => ({
            ...r,
            operatedAt: r.operatedAt.toISOString(),
            evidence: r.evidence || ''
        }))));
        parts.push('');
        parts.push('## 任务状态');
        const taskHeader = [
            { id: 'taskId', title: '任务ID' },
            { id: 'taskName', title: '任务名称' },
            { id: 'executionStatus', title: '执行状态' },
            { id: 'startedAt', title: '开始时间' },
            { id: 'completedAt', title: '完成时间' }
        ];
        const taskStringifier = (0, csv_writer_1.createObjectCsvStringifier)({ header: taskHeader });
        const taskHeaderStr = taskStringifier.getHeaderString();
        if (taskHeaderStr) {
            parts.push(taskHeaderStr);
        }
        parts.push(taskStringifier.stringifyRecords(request.tasks.map(t => ({
            taskId: t.taskId,
            taskName: t.taskName,
            executionStatus: t.executionStatus,
            startedAt: t.startedAt?.toISOString() || '',
            completedAt: t.completedAt?.toISOString() || ''
        }))));
        parts.push('');
        if (request.reports.length > 0) {
            parts.push('## 撤销报告');
            parts.push(`共 ${request.reports.length} 份报告`);
            parts.push('');
        }
        if (request.failurePaths.length > 0) {
            parts.push('## 失败路径记录');
            const failureHeader = [
                { id: 'occurredAt', title: '发生时间' },
                { id: 'processingBasis', title: '处理依据' },
                { id: 'conclusion', title: '结论' }
            ];
            const failureStringifier = (0, csv_writer_1.createObjectCsvStringifier)({ header: failureHeader });
            const failureHeaderStr = failureStringifier.getHeaderString();
            if (failureHeaderStr) {
                parts.push(failureHeaderStr);
            }
            parts.push(failureStringifier.stringifyRecords(request.failurePaths.map(f => ({
                occurredAt: f.occurredAt.toISOString(),
                processingBasis: f.processingBasis,
                conclusion: f.conclusion
            }))));
        }
        return parts.join('\n');
    }
    serializeDate(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }
        if (obj instanceof Date) {
            return obj.toISOString();
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.serializeDate(item));
        }
        if (typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.serializeDate(value);
            }
            return result;
        }
        return obj;
    }
    getExportFilename(requestId, format, type) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `cancel-${type}-${requestId}-${timestamp}.${format}`;
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
//# sourceMappingURL=ExportService.js.map