"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const ApprovalFlow_1 = __importDefault(require("../models/ApprovalFlow"));
const ExportRequest_1 = __importDefault(require("../models/ExportRequest"));
const User_1 = __importDefault(require("../models/User"));
const ExceptionService_1 = __importDefault(require("./ExceptionService"));
class ApprovalService {
    async createApprovalFlow(requestId, hasHighRisk) {
        const approvers = await User_1.default.findAll({
            where: { role: 'approver' },
            order: [['createdAt', 'ASC']],
        });
        const approvalLevels = hasHighRisk ? 2 : 1;
        const selectedApprovers = approvers.slice(0, approvalLevels);
        const flowRecords = [];
        for (let i = 0; i < selectedApprovers.length; i++) {
            const flow = await ApprovalFlow_1.default.create({
                id: (0, uuid_1.v4)(),
                requestId,
                approverId: selectedApprovers[i].id,
                approverName: selectedApprovers[i].name,
                level: i + 1,
                status: i === 0 ? 'pending' : 'pending',
            });
            flowRecords.push(flow);
        }
        return flowRecords;
    }
    async getApprovalFlowByRequest(requestId) {
        return ApprovalFlow_1.default.findAll({
            where: { requestId },
            order: [['level', 'ASC']],
        });
    }
    async approveRequest(dto) {
        const request = await ExportRequest_1.default.findByPk(dto.requestId);
        if (!request) {
            return { success: false, message: '导出申请不存在', allApproved: false };
        }
        if (request.status !== 'pending') {
            await ExceptionService_1.default.recordException('repeated_operation', `尝试重复审批：申请 ${dto.requestId} 已处于 ${request.status} 状态`, dto.requestId, { currentStatus: request.status });
            return {
                success: false,
                message: `该申请当前状态为「${this.translateStatus(request.status)}」，无法再次审批`,
                allApproved: false,
            };
        }
        const approvalFlows = await this.getApprovalFlowByRequest(dto.requestId);
        const currentApproval = approvalFlows.find((f) => f.approverId === dto.approverId && f.status === 'pending');
        if (!currentApproval) {
            const approverFlows = approvalFlows.filter((f) => f.approverId === dto.approverId);
            if (approverFlows.length > 0 && approverFlows[0].status !== 'pending') {
                await ExceptionService_1.default.recordException('repeated_operation', `审批人尝试重复操作：申请 ${dto.requestId}，审批人 ${dto.approverId}`, dto.requestId, { approverId: dto.approverId });
                return {
                    success: false,
                    message: '您已经完成过该申请的审批，请勿重复操作',
                    allApproved: false,
                };
            }
            return { success: false, message: '您当前没有待审批的该申请', allApproved: false };
        }
        const previousApprovals = approvalFlows.filter((f) => f.level < currentApproval.level && f.status !== 'approved');
        if (previousApprovals.length > 0) {
            return {
                success: false,
                message: '请等待前序审批人完成审批后再操作',
                allApproved: false,
            };
        }
        currentApproval.status = 'approved';
        currentApproval.comment = dto.comment || null;
        currentApproval.decisionTime = new Date();
        await currentApproval.save();
        const allApproved = approvalFlows.every((f) => f.status === 'approved' || f.id === currentApproval.id);
        if (allApproved) {
            request.status = 'approved';
            await request.save();
            return {
                success: true,
                message: '审批通过，申请已进入数据处理阶段',
                allApproved: true,
                request,
            };
        }
        return {
            success: true,
            message: '审批通过，等待下一级审批',
            allApproved: false,
        };
    }
    async rejectRequest(dto) {
        const request = await ExportRequest_1.default.findByPk(dto.requestId);
        if (!request) {
            return { success: false, message: '导出申请不存在' };
        }
        if (request.status !== 'pending') {
            return {
                success: false,
                message: `该申请当前状态为「${this.translateStatus(request.status)}」，无法驳回`,
            };
        }
        const approvalFlows = await this.getApprovalFlowByRequest(dto.requestId);
        const currentApproval = approvalFlows.find((f) => f.approverId === dto.approverId && f.status === 'pending');
        if (!currentApproval) {
            return { success: false, message: '您当前没有待审批的该申请' };
        }
        currentApproval.status = 'rejected';
        currentApproval.comment = dto.comment;
        currentApproval.decisionTime = new Date();
        await currentApproval.save();
        request.status = 'rejected';
        await request.save();
        return {
            success: true,
            message: `已驳回申请，驳回理由：${dto.comment}`,
            request,
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
}
exports.default = new ApprovalService();
