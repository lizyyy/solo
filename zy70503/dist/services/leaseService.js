"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaseService = exports.LeaseService = void 0;
const database_1 = require("../database");
const types_1 = require("../types");
class LeaseService {
    async createLease(request) {
        const existingLease = await database_1.db.findLeaseByIdempotencyKey(request.idempotencyKey);
        if (existingLease) {
            return {
                success: true,
                data: existingLease,
                isIdempotent: true,
                message: '重复申请，返回已存在的租约'
            };
        }
        const leaseStartTime = Date.now();
        const leaseEndTime = leaseStartTime + request.leaseDurationHours * 60 * 60 * 1000;
        try {
            const newLease = await database_1.db.createLease({
                accountName: request.accountName,
                permissionItem: request.permissionItem,
                leaseStartTime,
                leaseEndTime,
                applicationReason: request.applicationReason,
                applicant: request.applicant,
                status: types_1.LeaseStatus.PENDING,
                idempotencyKey: request.idempotencyKey
            });
            await database_1.db.createAuditLog({
                leaseId: newLease.id,
                operationType: 'CREATE',
                operator: request.applicant,
                originalInput: request,
                processingBasis: '用户申请权限租约',
                finalConclusion: '租约创建成功，状态为待处理',
                statusBefore: '',
                statusAfter: types_1.LeaseStatus.PENDING
            });
            return {
                success: true,
                data: newLease,
                isIdempotent: false,
                message: '租约创建成功'
            };
        }
        catch (error) {
            await database_1.db.createAuditLog({
                leaseId: 'error-' + Date.now(),
                operationType: 'CREATE_FAILED',
                operator: request.applicant,
                originalInput: request,
                processingBasis: '数据库操作异常',
                finalConclusion: `租约创建失败: ${error.message}`,
                statusBefore: '',
                statusAfter: ''
            });
            return {
                success: false,
                error: error.message,
                message: '租约创建失败'
            };
        }
    }
    async queryLeases(request) {
        try {
            const result = await database_1.db.queryLeases(request);
            return {
                success: true,
                data: result.data,
                total: result.total,
                page: request.page || 1,
                pageSize: request.pageSize || 20,
                message: '查询成功'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                message: '查询失败'
            };
        }
    }
    async getLeaseDetail(leaseId) {
        try {
            const lease = await database_1.db.findLeaseById(leaseId);
            if (!lease) {
                return {
                    success: false,
                    error: 'LEASE_NOT_FOUND',
                    message: '租约不存在'
                };
            }
            const renewalRecords = await database_1.db.getRenewalRecordsByLeaseId(leaseId);
            const auditLogs = await database_1.db.getAuditLogsByLeaseId(leaseId);
            return {
                success: true,
                data: {
                    lease,
                    renewalRecords,
                    auditLogs
                },
                message: '查询成功'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                message: '查询失败'
            };
        }
    }
    async advanceStatus(request) {
        try {
            const lease = await database_1.db.findLeaseById(request.leaseId);
            if (!lease) {
                return {
                    success: false,
                    error: 'LEASE_NOT_FOUND',
                    message: '租约不存在'
                };
            }
            const statusBefore = lease.status;
            const statusAfter = request.targetStatus;
            const validTransitions = {
                [types_1.LeaseStatus.PENDING]: [types_1.LeaseStatus.CONFIRMED, types_1.LeaseStatus.BLOCKED, types_1.LeaseStatus.REVOKED],
                [types_1.LeaseStatus.CONFIRMED]: [types_1.LeaseStatus.EXPIRED, types_1.LeaseStatus.RECYCLED, types_1.LeaseStatus.BLOCKED, types_1.LeaseStatus.REVOKED],
                [types_1.LeaseStatus.BLOCKED]: [types_1.LeaseStatus.COMPENSATED, types_1.LeaseStatus.REVOKED],
                [types_1.LeaseStatus.REVOKED]: [],
                [types_1.LeaseStatus.COMPENSATED]: [types_1.LeaseStatus.CONFIRMED, types_1.LeaseStatus.REVOKED],
                [types_1.LeaseStatus.EXPIRED]: [types_1.LeaseStatus.RECYCLED, types_1.LeaseStatus.COMPENSATED],
                [types_1.LeaseStatus.RECYCLED]: []
            };
            if (!validTransitions[statusBefore]?.includes(statusAfter)) {
                await database_1.db.createAuditLog({
                    leaseId: request.leaseId,
                    operationType: 'STATUS_ADVANCE_FAILED',
                    operator: request.operator,
                    originalInput: request,
                    processingBasis: `状态转换不合法: ${statusBefore} -> ${statusAfter}`,
                    finalConclusion: '状态推进失败，转换路径不被允许',
                    statusBefore,
                    statusAfter: statusBefore
                });
                return {
                    success: false,
                    error: 'INVALID_TRANSITION',
                    message: `不允许从 ${statusBefore} 转换到 ${statusAfter}`
                };
            }
            const additionalFields = {};
            if (statusAfter === types_1.LeaseStatus.RECYCLED) {
                additionalFields.recyclingConclusion = request.reason;
            }
            if (statusAfter === types_1.LeaseStatus.BLOCKED) {
                additionalFields.blockedReason = request.reason;
            }
            await database_1.db.updateLeaseStatus(request.leaseId, statusAfter, additionalFields);
            await database_1.db.createAuditLog({
                leaseId: request.leaseId,
                operationType: 'STATUS_ADVANCE',
                operator: request.operator,
                originalInput: request,
                processingBasis: request.reason,
                finalConclusion: `状态从 ${statusBefore} 成功转换为 ${statusAfter}`,
                statusBefore,
                statusAfter
            });
            return {
                success: true,
                data: { statusBefore, statusAfter },
                message: '状态推进成功'
            };
        }
        catch (error) {
            await database_1.db.createAuditLog({
                leaseId: request.leaseId,
                operationType: 'STATUS_ADVANCE_FAILED',
                operator: request.operator,
                originalInput: request,
                processingBasis: '系统异常',
                finalConclusion: `状态推进失败: ${error.message}`,
                statusBefore: '',
                statusAfter: ''
            });
            return {
                success: false,
                error: error.message,
                message: '状态推进失败'
            };
        }
    }
    async requestRenewal(request) {
        try {
            const lease = await database_1.db.findLeaseById(request.leaseId);
            if (!lease) {
                return {
                    success: false,
                    error: 'LEASE_NOT_FOUND',
                    message: '租约不存在'
                };
            }
            if (lease.status !== types_1.LeaseStatus.CONFIRMED) {
                return {
                    success: false,
                    error: 'INVALID_STATUS',
                    message: '只有已确认的租约才能申请续租'
                };
            }
            const renewalRecord = await database_1.db.createRenewalRecord({
                leaseId: request.leaseId,
                previousEndTime: lease.leaseEndTime,
                newEndTime: lease.leaseEndTime + request.additionalHours * 60 * 60 * 1000,
                renewalReason: request.renewalReason,
                status: types_1.RenewalStatus.PENDING
            });
            await database_1.db.createAuditLog({
                leaseId: request.leaseId,
                operationType: 'RENEWAL_REQUEST',
                operator: request.applicant,
                originalInput: request,
                processingBasis: `用户申请续租 ${request.additionalHours} 小时`,
                finalConclusion: '续租申请已提交，等待审批',
                statusBefore: lease.status,
                statusAfter: lease.status
            });
            return {
                success: true,
                data: renewalRecord,
                message: '续租申请已提交'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                message: '续租申请失败'
            };
        }
    }
    async approveRenewal(renewalId, approver, approved) {
        try {
            const records = await database_1.db.getRenewalRecordsByLeaseId('');
            const renewalRecord = records.find(r => r.id === renewalId);
            if (!renewalRecord) {
                return {
                    success: false,
                    error: 'RENEWAL_NOT_FOUND',
                    message: '续租记录不存在'
                };
            }
            if (renewalRecord.status !== types_1.RenewalStatus.PENDING) {
                return {
                    success: false,
                    error: 'INVALID_STATUS',
                    message: '该续租申请已处理'
                };
            }
            const lease = await database_1.db.findLeaseById(renewalRecord.leaseId);
            if (!lease) {
                return {
                    success: false,
                    error: 'LEASE_NOT_FOUND',
                    message: '租约不存在'
                };
            }
            if (approved) {
                await database_1.db.updateRenewalStatus(renewalId, types_1.RenewalStatus.APPROVED, approver);
                await database_1.db.manualUpdateLease(renewalRecord.leaseId, {
                    leaseEndTime: renewalRecord.newEndTime
                });
                await database_1.db.createAuditLog({
                    leaseId: renewalRecord.leaseId,
                    operationType: 'RENEWAL_APPROVED',
                    operator: approver,
                    originalInput: { renewalId, approved },
                    processingBasis: '续租审批通过',
                    finalConclusion: `续租已批准，租约结束时间延长至 ${new Date(renewalRecord.newEndTime).toISOString()}`,
                    statusBefore: lease.status,
                    statusAfter: lease.status
                });
            }
            else {
                await database_1.db.updateRenewalStatus(renewalId, types_1.RenewalStatus.REJECTED, approver);
                await database_1.db.createAuditLog({
                    leaseId: renewalRecord.leaseId,
                    operationType: 'RENEWAL_REJECTED',
                    operator: approver,
                    originalInput: { renewalId, approved },
                    processingBasis: '续租审批拒绝',
                    finalConclusion: '续租申请已被拒绝',
                    statusBefore: lease.status,
                    statusAfter: lease.status
                });
            }
            return {
                success: true,
                message: approved ? '续租已批准' : '续租已拒绝'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                message: '续租审批失败'
            };
        }
    }
    async handleExpiredLeases() {
        try {
            const expiredLeases = await database_1.db.getExpiredLeases();
            const results = [];
            for (const lease of expiredLeases) {
                const result = await this.advanceStatus({
                    leaseId: lease.id,
                    targetStatus: types_1.LeaseStatus.EXPIRED,
                    operator: 'system',
                    reason: '租约到期自动过期'
                });
                results.push({ leaseId: lease.id, result });
            }
            return {
                success: true,
                data: results,
                processedCount: expiredLeases.length,
                message: `已处理 ${expiredLeases.length} 个过期租约`
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                message: '处理过期租约失败'
            };
        }
    }
    async manualCorrection(request) {
        try {
            const lease = await database_1.db.findLeaseById(request.leaseId);
            if (!lease) {
                return {
                    success: false,
                    error: 'LEASE_NOT_FOUND',
                    message: '租约不存在'
                };
            }
            const { id, createdAt, ...allowedUpdates } = request.updates;
            await database_1.db.manualUpdateLease(request.leaseId, allowedUpdates);
            await database_1.db.createAuditLog({
                leaseId: request.leaseId,
                operationType: 'MANUAL_CORRECTION',
                operator: request.operator,
                originalInput: request,
                processingBasis: request.correctionReason,
                finalConclusion: '人工修正已执行',
                statusBefore: lease.status,
                statusAfter: allowedUpdates.status || lease.status
            });
            return {
                success: true,
                message: '人工修正成功'
            };
        }
        catch (error) {
            await database_1.db.createAuditLog({
                leaseId: request.leaseId,
                operationType: 'MANUAL_CORRECTION_FAILED',
                operator: request.operator,
                originalInput: request,
                processingBasis: '系统异常',
                finalConclusion: `人工修正失败: ${error.message}`,
                statusBefore: '',
                statusAfter: ''
            });
            return {
                success: false,
                error: error.message,
                message: '人工修正失败'
            };
        }
    }
    async exportLeases(params) {
        try {
            const leases = await database_1.db.getAllLeasesForExport(params);
            return {
                success: true,
                data: leases,
                count: leases.length,
                message: '导出成功'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                message: '导出失败'
            };
        }
    }
}
exports.LeaseService = LeaseService;
exports.leaseService = new LeaseService();
//# sourceMappingURL=leaseService.js.map