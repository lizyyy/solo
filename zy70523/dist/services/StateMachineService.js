"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateMachineService = exports.StateMachineService = void 0;
const types_1 = require("../types");
const database_1 = require("../database");
class StateMachineService {
    constructor() {
        this.transitions = [
            {
                from: [types_1.FilingStatus.PENDING],
                to: types_1.FilingStatus.CONFIRMED,
                allowed: true,
                requiresApproval: true,
                description: '确认备案申请'
            },
            {
                from: [types_1.FilingStatus.PENDING, types_1.FilingStatus.CONFIRMED],
                to: types_1.FilingStatus.BLOCKED,
                allowed: true,
                description: '拦截备案申请'
            },
            {
                from: [types_1.FilingStatus.BLOCKED],
                to: types_1.FilingStatus.REVOKED,
                allowed: true,
                description: '撤销已拦截的备案'
            },
            {
                from: [types_1.FilingStatus.BLOCKED],
                to: types_1.FilingStatus.COMPENSATED,
                allowed: true,
                description: '补偿已拦截的备案'
            },
            {
                from: [types_1.FilingStatus.CONFIRMED],
                to: types_1.FilingStatus.CLOSED,
                allowed: true,
                description: '关闭备案'
            },
            {
                from: [types_1.FilingStatus.CONFIRMED],
                to: types_1.FilingStatus.EXPIRED,
                allowed: true,
                description: '窗口到期自动关闭'
            },
            {
                from: [types_1.FilingStatus.REVOKED, types_1.FilingStatus.COMPENSATED, types_1.FilingStatus.EXPIRED],
                to: types_1.FilingStatus.CLOSED,
                allowed: true,
                description: '最终关闭'
            }
        ];
    }
    canTransition(currentStatus, targetStatus) {
        const transition = this.transitions.find(t => t.from.includes(currentStatus) && t.to === targetStatus);
        return transition?.allowed || false;
    }
    requiresApproval(currentStatus, targetStatus) {
        const transition = this.transitions.find(t => t.from.includes(currentStatus) && t.to === targetStatus);
        return transition?.requiresApproval || false;
    }
    getTransitionDescription(currentStatus, targetStatus) {
        const transition = this.transitions.find(t => t.from.includes(currentStatus) && t.to === targetStatus);
        return transition?.description || '未知状态转换';
    }
    async advanceStatus(filingId, targetStatus, operator, reason) {
        const filing = await database_1.db.getFiling(filingId);
        if (!filing) {
            throw new Error('备案记录不存在');
        }
        if (!this.canTransition(filing.status, targetStatus)) {
            throw new Error(`不允许从 ${filing.status} 转换到 ${targetStatus}`);
        }
        if (this.requiresApproval(filing.status, targetStatus)) {
            if (filing.approvalStatus !== types_1.ApprovalStatus.APPROVED) {
                throw new Error('此状态转换需要先审批通过');
            }
        }
        await database_1.db.updateFilingStatus(filingId, targetStatus, operator, reason);
        const updatedFiling = await database_1.db.getFiling(filingId);
        if (!updatedFiling) {
            throw new Error('更新后备案记录不存在');
        }
        return updatedFiling;
    }
    async approveFiling(filingId, approver) {
        const filing = await database_1.db.getFiling(filingId);
        if (!filing) {
            throw new Error('备案记录不存在');
        }
        await database_1.db.updateApprovalStatus(filingId, types_1.ApprovalStatus.APPROVED, approver);
        const updatedFiling = await database_1.db.getFiling(filingId);
        if (!updatedFiling) {
            throw new Error('更新后备案记录不存在');
        }
        return updatedFiling;
    }
    async rejectFiling(filingId, approver, reason) {
        const filing = await database_1.db.getFiling(filingId);
        if (!filing) {
            throw new Error('备案记录不存在');
        }
        await database_1.db.updateApprovalStatus(filingId, types_1.ApprovalStatus.REJECTED, approver);
        await database_1.db.updateFilingStatus(filingId, types_1.FilingStatus.REVOKED, approver, reason);
        const updatedFiling = await database_1.db.getFiling(filingId);
        if (!updatedFiling) {
            throw new Error('更新后备案记录不存在');
        }
        return updatedFiling;
    }
    getAllTransitions() {
        return this.transitions;
    }
}
exports.StateMachineService = StateMachineService;
exports.stateMachineService = new StateMachineService();
