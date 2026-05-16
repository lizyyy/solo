"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filingService = exports.FilingService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const duration_1 = __importDefault(require("dayjs/plugin/duration"));
const json2csv_1 = require("json2csv");
const types_1 = require("../types");
const database_1 = require("../database");
const StateMachineService_1 = require("./StateMachineService");
dayjs_1.default.extend(duration_1.default);
class FilingService {
    async createFiling(request) {
        this.validateOpenWindow(request.openWindow);
        return database_1.db.createFiling(request);
    }
    async getFiling(id) {
        return database_1.db.getFiling(id);
    }
    async listFilings(filters) {
        return database_1.db.listFilings(filters);
    }
    async advanceStatus(id, targetStatus, operator, reason) {
        return StateMachineService_1.stateMachineService.advanceStatus(id, targetStatus, operator, reason);
    }
    async approveFiling(id, approver) {
        return StateMachineService_1.stateMachineService.approveFiling(id, approver);
    }
    async rejectFiling(id, approver, reason) {
        return StateMachineService_1.stateMachineService.rejectFiling(id, approver, reason);
    }
    async handleException(filingId, request) {
        await database_1.db.recordException(filingId, request);
    }
    async getExceptions(filingId) {
        return database_1.db.getExceptions(filingId);
    }
    async manualCorrection(filingId, request) {
        const filing = await database_1.db.getFiling(filingId);
        if (!filing) {
            throw new Error('备案记录不存在');
        }
        const editableFields = ['serviceName', 'egressAddress', 'purpose'];
        if (!editableFields.includes(request.field)) {
            throw new Error(`字段 ${request.field} 不允许人工修正`);
        }
        await database_1.db.recordManualCorrection(filingId, request.field, request.oldValue, request.newValue, request.operator, request.reason);
        await database_1.db.updateFilingField(filingId, request.field, request.newValue);
        const updatedFiling = await database_1.db.getFiling(filingId);
        if (!updatedFiling) {
            throw new Error('更新后备案记录不存在');
        }
        return updatedFiling;
    }
    async closeFiling(id, closer, reason) {
        await database_1.db.closeFiling(id, closer, reason);
    }
    async recordAccess(filingId, sourceIp, destination, action, result) {
        return database_1.db.recordAccessLog(filingId, sourceIp, destination, action, result);
    }
    async getAccessLogs(filingId) {
        return database_1.db.getAccessLogs(filingId);
    }
    async generateReport(filingId) {
        const filing = await database_1.db.getFiling(filingId);
        if (!filing) {
            throw new Error('备案记录不存在');
        }
        const [statusHistory, accessLogs, exceptions] = await Promise.all([
            database_1.db.getStatusHistory(filingId),
            database_1.db.getAccessLogs(filingId),
            database_1.db.getExceptions(filingId)
        ]);
        const startTime = (0, dayjs_1.default)(filing.openWindow.startTime);
        const endTime = (0, dayjs_1.default)(filing.closedAt || filing.openWindow.endTime);
        const openDuration = dayjs_1.default.duration(endTime.diff(startTime)).asMinutes();
        const report = {
            filingId,
            generatedAt: (0, dayjs_1.default)().toISOString(),
            summary: {
                serviceName: filing.serviceName,
                openDuration: Math.round(openDuration),
                accessCount: accessLogs.length,
                statusChanges: statusHistory.length
            },
            details: {
                statusHistory,
                accessLogs,
                exceptions
            },
            conclusion: this.generateConclusion(filing, exceptions)
        };
        return report;
    }
    async exportToCSV(filingId) {
        const report = await this.generateReport(filingId);
        const fields = [
            'filingId',
            'generatedAt',
            'summary.serviceName',
            'summary.openDuration',
            'summary.accessCount',
            'summary.statusChanges',
            'conclusion'
        ];
        const json2csvParser = new json2csv_1.Parser({ fields });
        const csv = json2csvParser.parse(report);
        return csv;
    }
    async checkExpiredWindows() {
        const now = (0, dayjs_1.default)();
        const filings = await database_1.db.listFilings({ status: types_1.FilingStatus.CONFIRMED });
        const expiredIds = [];
        for (const filing of filings) {
            const endTime = (0, dayjs_1.default)(filing.openWindow.endTime);
            if (now.isAfter(endTime)) {
                await StateMachineService_1.stateMachineService.advanceStatus(filing.id, types_1.FilingStatus.EXPIRED, 'system', '开放窗口已到期');
                expiredIds.push(filing.id);
            }
        }
        return expiredIds;
    }
    validateOpenWindow(openWindow) {
        const startTime = (0, dayjs_1.default)(openWindow.startTime);
        const endTime = (0, dayjs_1.default)(openWindow.endTime);
        if (!startTime.isValid() || !endTime.isValid()) {
            throw new Error('时间格式无效');
        }
        if (endTime.isBefore(startTime)) {
            throw new Error('结束时间不能早于开始时间');
        }
        const maxDuration = dayjs_1.default.duration(7, 'day');
        const duration = dayjs_1.default.duration(endTime.diff(startTime));
        if (duration.asMilliseconds() > maxDuration.asMilliseconds()) {
            throw new Error('开放窗口最长为7天');
        }
    }
    generateConclusion(filing, exceptions) {
        const conclusions = [];
        conclusions.push(`服务 ${filing.serviceName} 备案最终状态为 ${filing.status}`);
        if (exceptions.length > 0) {
            conclusions.push(`处理过程中发生 ${exceptions.length} 次异常`);
            const blockedException = exceptions.find(e => e.step === 'security_check');
            if (blockedException) {
                conclusions.push(`安全检查拦截原因: ${blockedException.conclusion}`);
            }
        }
        if (filing.closedAt) {
            conclusions.push(`关闭原因: ${filing.closeReason || '未记录'}`);
        }
        return conclusions.join('；');
    }
}
exports.FilingService = FilingService;
exports.filingService = new FilingService();
