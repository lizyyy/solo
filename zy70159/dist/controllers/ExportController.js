"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ExportService_1 = __importDefault(require("../services/ExportService"));
const ApprovalService_1 = __importDefault(require("../services/ApprovalService"));
const ExceptionService_1 = __importDefault(require("../services/ExceptionService"));
const SensitiveFieldService_1 = __importDefault(require("../services/SensitiveFieldService"));
const response_1 = require("../utils/response");
class ExportController {
    async createExportRequest(req, res) {
        try {
            const result = await ExportService_1.default.createExportRequest(req.body);
            if (result.success) {
                res.json((0, response_1.successResponse)({
                    requestId: result.request?.id,
                    needSpecialApproval: result.needSpecialApproval,
                    approvalFlow: result.flowRecords,
                }, result.message));
            }
            else {
                res.json((0, response_1.errorResponse)('CREATE_FAILED', result.message));
            }
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `系统异常：${error.message}`, { error: error.message }));
        }
    }
    async getRequest(req, res) {
        try {
            const { id } = req.params;
            const request = await ExportService_1.default.getRequestById(id);
            if (!request) {
                res.json((0, response_1.errorResponse)('NOT_FOUND', '导出申请不存在'));
                return;
            }
            res.json((0, response_1.successResponse)(request, '查询成功'));
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `查询失败：${error.message}`));
        }
    }
    async approveRequest(req, res) {
        try {
            const result = await ApprovalService_1.default.approveRequest(req.body);
            if (result.success) {
                res.json((0, response_1.successResponse)({
                    allApproved: result.allApproved,
                    requestId: req.body.requestId,
                }, result.message));
            }
            else {
                res.json((0, response_1.errorResponse)('APPROVE_FAILED', result.message));
            }
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `审批异常：${error.message}`));
        }
    }
    async rejectRequest(req, res) {
        try {
            const result = await ApprovalService_1.default.rejectRequest(req.body);
            if (result.success) {
                res.json((0, response_1.successResponse)({ requestId: req.body.requestId }, result.message));
            }
            else {
                res.json((0, response_1.errorResponse)('REJECT_FAILED', result.message));
            }
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `驳回异常：${error.message}`));
        }
    }
    async processApprovedRequest(req, res) {
        try {
            const { requestId } = req.body;
            const result = await ExportService_1.default.processApprovedRequest(requestId);
            if (result.success) {
                res.json((0, response_1.successResponse)({
                    downloadUrl: result.downloadUrl,
                    expiryTime: result.expiryTime,
                }, result.message));
            }
            else {
                res.json((0, response_1.errorResponse)('PROCESS_FAILED', result.message));
            }
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `处理异常：${error.message}`));
        }
    }
    async downloadFile(req, res) {
        try {
            const { id } = req.params;
            const { requesterId } = req.body;
            const clientInfo = {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };
            const result = await ExportService_1.default.downloadFile(id, requesterId, clientInfo);
            if (result.success && result.fileContent) {
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${result.fileName || 'export.csv'}"`);
                res.send(result.fileContent);
            }
            else {
                res.json((0, response_1.errorResponse)('DOWNLOAD_FAILED', result.message));
            }
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `下载异常：${error.message}`));
        }
    }
    async getTaskReport(req, res) {
        try {
            const { id } = req.params;
            const result = await ExportService_1.default.generateTaskReport(id);
            if (result.success && result.report) {
                res.json((0, response_1.successResponse)(result.report, result.message));
            }
            else {
                res.json((0, response_1.errorResponse)('REPORT_FAILED', result.message));
            }
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `生成报告异常：${error.message}`));
        }
    }
    async getPendingExceptions(req, res) {
        try {
            const exceptions = await ExceptionService_1.default.getPendingExceptions();
            res.json((0, response_1.successResponse)(exceptions, `共找到 ${exceptions.length} 条待处理异常`));
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `查询异常列表失败：${error.message}`));
        }
    }
    async getAllExceptions(req, res) {
        try {
            const exceptions = await ExceptionService_1.default.getAllExceptions();
            res.json((0, response_1.successResponse)(exceptions, `共找到 ${exceptions.length} 条异常记录`));
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `查询异常列表失败：${error.message}`));
        }
    }
    async processException(req, res) {
        try {
            const { id } = req.params;
            const { processorId, action } = req.body;
            const exception = await ExceptionService_1.default.processException(id, processorId, action);
            if (!exception) {
                res.json((0, response_1.errorResponse)('NOT_FOUND', '异常记录不存在'));
                return;
            }
            res.json((0, response_1.successResponse)(exception, action === 'processed' ? '异常已处理完成' : '异常已忽略'));
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `处理异常失败：${error.message}`));
        }
    }
    async getSensitiveFields(req, res) {
        try {
            const fields = await SensitiveFieldService_1.default.getAllSensitiveFields();
            res.json((0, response_1.successResponse)(fields, `共定义 ${fields.length} 个敏感字段`));
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('SYSTEM_ERROR', `查询敏感字段失败：${error.message}`));
        }
    }
    async createSensitiveField(req, res) {
        try {
            const field = await SensitiveFieldService_1.default.createSensitiveField(req.body);
            res.json((0, response_1.successResponse)(field, `敏感字段 ${field.fieldName} 创建成功`));
        }
        catch (error) {
            res.json((0, response_1.errorResponse)('CREATE_FAILED', error.message));
        }
    }
}
exports.default = new ExportController();
