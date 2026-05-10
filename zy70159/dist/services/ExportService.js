"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const ExportRequest_1 = __importDefault(require("../models/ExportRequest"));
const User_1 = __importDefault(require("../models/User"));
const SensitiveFieldService_1 = __importDefault(require("./SensitiveFieldService"));
const ApprovalService_1 = __importDefault(require("./ApprovalService"));
const ExceptionService_1 = __importDefault(require("./ExceptionService"));
const DownloadAudit_1 = __importDefault(require("../models/DownloadAudit"));
const masking_1 = require("../utils/masking");
class ExportService {
    async createExportRequest(dto) {
        const user = await User_1.default.findByPk(dto.requesterId);
        if (!user) {
            return { success: false, message: '申请人信息不存在', needSpecialApproval: false };
        }
        if (dto.fieldsToExport.length === 0) {
            return { success: false, message: '请至少选择一个要导出的字段', needSpecialApproval: false };
        }
        const existingPending = await ExportRequest_1.default.findOne({
            where: {
                requesterId: dto.requesterId,
                dataCategory: dto.dataCategory,
                status: 'pending',
            },
        });
        if (existingPending) {
            await ExceptionService_1.default.recordException('repeated_operation', `用户 ${dto.requesterId} 尝试重复提交同类型导出申请`, existingPending.id, { existingRequestId: existingPending.id });
            return {
                success: false,
                message: '您已有同类导出申请正在审批中，请先完成该申请后再提交新申请',
                needSpecialApproval: false,
            };
        }
        const fieldValidation = await SensitiveFieldService_1.default.validateFieldsForExport(dto.fieldsToExport);
        const request = await ExportRequest_1.default.create({
            id: (0, uuid_1.v4)(),
            requesterId: dto.requesterId,
            requesterName: user.name,
            dataCategory: dto.dataCategory,
            exportTimeRange: dto.exportTimeRange,
            fieldsToExport: dto.fieldsToExport,
            purpose: dto.purpose,
            status: 'pending',
        });
        const flowRecords = await ApprovalService_1.default.createApprovalFlow(request.id, !fieldValidation.valid);
        const approvalInfo = this.formatApprovalInfo(flowRecords);
        if (!fieldValidation.valid) {
            return {
                success: true,
                message: `已提交导出申请，但包含高风险字段，需要 ${approvalInfo}`,
                request,
                needSpecialApproval: true,
                flowRecords: this.simplifyFlowRecords(flowRecords),
            };
        }
        return {
            success: true,
            message: `已成功提交导出申请，等待 ${approvalInfo}`,
            request,
            needSpecialApproval: false,
            flowRecords: this.simplifyFlowRecords(flowRecords),
        };
    }
    async getRequestById(id) {
        return ExportRequest_1.default.findByPk(id);
    }
    async getRequestsByUser(requesterId) {
        return ExportRequest_1.default.findAll({
            where: { requesterId },
            order: [['createdAt', 'DESC']],
        });
    }
    async processApprovedRequest(requestId) {
        const request = await ExportRequest_1.default.findByPk(requestId);
        if (!request) {
            return { success: false, message: '导出申请不存在' };
        }
        if (request.status !== 'approved') {
            return {
                success: false,
                message: `申请状态为「${this.translateStatus(request.status)}」，无法进行数据处理`,
            };
        }
        request.status = 'processing';
        await request.save();
        try {
            const maskedSampleData = await this.generateMaskedData(request.fieldsToExport);
            const expiryHours = 24;
            const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
            const fileUrl = `/api/export/download/${request.id}`;
            const fileName = `export_${request.dataCategory}_${Date.now()}.csv`;
            request.status = 'completed';
            request.fileUrl = fileUrl;
            request.fileName = fileName;
            request.fileExpiryTime = expiryTime;
            await request.save();
            return {
                success: true,
                message: `数据处理完成，已完成脱敏处理，文件将在 ${expiryHours} 小时后过期`,
                downloadUrl: fileUrl,
                expiryTime,
            };
        }
        catch (error) {
            request.status = 'pending';
            await request.save();
            await ExceptionService_1.default.recordException('task_failure', `导出数据处理失败：${error.message}`, requestId, { error: error.message });
            return {
                success: false,
                message: `数据处理过程中出现问题，已记录异常待处理`,
            };
        }
    }
    async downloadFile(requestId, requesterId, clientInfo) {
        const request = await ExportRequest_1.default.findByPk(requestId);
        if (!request) {
            return { success: false, message: '导出申请不存在' };
        }
        if (request.requesterId !== requesterId) {
            await this.recordDownloadAudit(requestId, requesterId, '未知用户', false, '非申请人尝试下载', clientInfo);
            await ExceptionService_1.default.recordException('download_failure', `非申请人尝试下载：申请 ${requestId}，操作人 ${requesterId}`, requestId, { requesterId, operatorId: requesterId });
            return { success: false, message: '您没有权限下载该文件' };
        }
        if (request.status !== 'completed') {
            await this.recordDownloadAudit(requestId, requesterId, request.requesterName, false, `文件状态异常：${this.translateStatus(request.status)}`, clientInfo);
            return {
                success: false,
                message: `文件当前状态为「${this.translateStatus(request.status)}」，无法下载`,
            };
        }
        const now = new Date();
        if (request.fileExpiryTime && now > request.fileExpiryTime) {
            request.status = 'expired';
            await request.save();
            await this.recordDownloadAudit(requestId, requesterId, request.requesterName, false, '文件已过期', clientInfo);
            await ExceptionService_1.default.recordException('file_expiry', `用户尝试下载已过期文件：申请 ${requestId}`, requestId, { expiryTime: request.fileExpiryTime, attemptTime: now });
            return {
                success: false,
                message: '文件已过期，请重新提交导出申请',
            };
        }
        const fileContent = await this.generateMaskedData(request.fieldsToExport, 10);
        request.downloadCount = (request.downloadCount || 0) + 1;
        await request.save();
        await this.recordDownloadAudit(requestId, requesterId, request.requesterName, true, null, clientInfo);
        return {
            success: true,
            message: `文件下载成功，这是第 ${request.downloadCount} 次下载`,
            fileContent,
            fileName: request.fileName || 'export.csv',
        };
    }
    async generateTaskReport(requestId) {
        const request = await ExportRequest_1.default.findByPk(requestId);
        if (!request) {
            return { success: false, message: '导出申请不存在' };
        }
        const approvalFlow = await ApprovalService_1.default.getApprovalFlowByRequest(requestId);
        const downloadAudits = await DownloadAudit_1.default.findAll({
            where: { requestId },
            order: [['downloadTime', 'ASC']],
        });
        const exceptionRecords = await ExceptionService_1.default.getAllExceptions();
        const relatedExceptions = exceptionRecords.filter((e) => e.requestId === requestId);
        return {
            success: true,
            message: '任务报告生成成功',
            report: {
                requestInfo: this.simplifyRequest(request),
                approvalFlow: approvalFlow.map((f) => ({
                    level: f.level,
                    approverName: f.approverName,
                    status: this.translateStatus(f.status),
                    comment: f.comment,
                    decisionTime: f.decisionTime,
                })),
                downloadAudits: downloadAudits.map((a) => ({
                    downloadTime: a.downloadTime,
                    success: a.success ? '成功' : '失败',
                    failureReason: a.failureReason,
                })),
                exceptionRecords: relatedExceptions.map((e) => ({
                    type: this.translateExceptionType(e.type),
                    description: e.description,
                    status: this.translateExceptionStatus(e.status),
                    createdAt: e.createdAt,
                })),
            },
        };
    }
    async generateMaskedData(fieldsToExport, rowCount = 5) {
        const sampleData = [];
        const header = fieldsToExport.join(',');
        sampleData.push(header);
        for (let i = 0; i < rowCount; i++) {
            const row = [];
            for (const field of fieldsToExport) {
                const originalValue = this.generateSampleValue(field, i);
                const maskingRule = await SensitiveFieldService_1.default.getMaskingRuleForField(field);
                const value = maskingRule ? (0, masking_1.maskValue)(originalValue, maskingRule) : originalValue;
                row.push(value);
            }
            sampleData.push(row.join(','));
        }
        return sampleData.join('\n');
    }
    generateSampleValue(field, index) {
        const samples = {
            name: ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '王十二'],
            phone: ['13800138001', '13900139002', '13700137003', '13600136004', '13500135005', '13400134006', '13300133007', '13200132008', '13100131009', '13000130010'],
            idCard: ['110101199001011234', '110101199002022345', '110101199003033456', '110101199004044567', '110101199005055678', '110101199006066789', '110101199007077890', '110101199008088901', '110101199009099012', '110101199010100123'],
            email: ['zhangsan@example.com', 'lisi@example.com', 'wangwu@example.com', 'zhaoliu@example.com', 'qianqi@example.com', 'sunba@example.com', 'zhoujiu@example.com', 'wushi@example.com', 'zhengshiyi@example.com', 'wangshier@example.com'],
            bankCard: ['6222021234567890123', '6222021234567890124', '6222021234567890125', '6222021234567890126', '6222021234567890127', '6222021234567890128', '6222021234567890129', '6222021234567890130', '6222021234567890131', '6222021234567890132'],
            address: ['北京市朝阳区建国路88号', '上海市浦东新区世纪大道100号', '广州市天河区天河路385号', '深圳市南山区科技园路1号', '杭州市西湖区文三路90号', '成都市锦江区红星路三段1号', '武汉市江汉区解放大道686号', '南京市鼓楼区中山北路201号', '西安市碑林区长安北路1号', '重庆市渝中区民权路88号'],
            department: ['研发部', '市场部', '销售部', '财务部', '人力资源部', '运营部', '客服部', '产品部', '测试部', '运维部'],
            position: ['工程师', '经理', '总监', '主管', '专员', '助理', '顾问', '分析师', '设计师', '架构师'],
            orderNo: ['ORD2024001', 'ORD2024002', 'ORD2024003', 'ORD2024004', 'ORD2024005', 'ORD2024006', 'ORD2024007', 'ORD2024008', 'ORD2024009', 'ORD2024010'],
            amount: ['1000.00', '2500.00', '5000.00', '10000.00', '25000.00', '50000.00', '100000.00', '250000.00', '500000.00', '1000000.00'],
        };
        const fieldSamples = samples[field];
        if (fieldSamples) {
            return fieldSamples[index % fieldSamples.length];
        }
        return `sample_${field}_${index + 1}`;
    }
    formatApprovalInfo(flows) {
        if (flows.length === 1) {
            return `${flows[0].approverName} 审批`;
        }
        return `多级审批：${flows.map((f) => `第${f.level}级-${f.approverName}`).join('、')}`;
    }
    simplifyFlowRecords(flows) {
        return flows.map((f) => ({
            level: f.level,
            approverName: f.approverName,
            status: this.translateStatus(f.status),
        }));
    }
    simplifyRequest(request) {
        return {
            id: request.id,
            requesterName: request.requesterName,
            dataCategory: request.dataCategory,
            status: this.translateStatus(request.status),
            downloadCount: request.downloadCount,
            fileExpiryTime: request.fileExpiryTime,
            createdAt: request.createdAt,
        };
    }
    translateStatus(status) {
        const statusMap = {
            pending: '待审批',
            approved: '已审批通过',
            rejected: '已驳回',
            processing: '数据处理中',
            completed: '已完成',
            expired: '已过期',
        };
        return statusMap[status] || status;
    }
    translateExceptionType(type) {
        const typeMap = {
            file_expiry: '文件过期',
            download_failure: '下载失败',
            task_failure: '任务失败',
            repeated_operation: '重复操作',
            sensitive_field_violation: '敏感字段违规',
            other: '其他异常',
        };
        return typeMap[type] || type;
    }
    translateExceptionStatus(status) {
        const statusMap = {
            pending: '待处理',
            processed: '已处理',
            ignored: '已忽略',
        };
        return statusMap[status] || status;
    }
    async recordDownloadAudit(requestId, requesterId, requesterName, success, failureReason, clientInfo) {
        await DownloadAudit_1.default.create({
            id: (0, uuid_1.v4)(),
            requestId,
            requesterId,
            requesterName,
            downloadTime: new Date(),
            success,
            failureReason,
            ipAddress: clientInfo?.ipAddress,
            userAgent: clientInfo?.userAgent,
        });
    }
}
exports.default = new ExportService();
