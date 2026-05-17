"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errors = exports.store = void 0;
exports.createLeaseService = createLeaseService;
exports.submitAutoRenewalService = submitAutoRenewalService;
exports.submitManualRenewalService = submitManualRenewalService;
exports.addRemarkService = addRemarkService;
exports.resolveConflictService = resolveConflictService;
exports.transitionStatusService = transitionStatusService;
exports.confirmRenewalService = confirmRenewalService;
exports.importLeasesService = importLeasesService;
const uuid_1 = require("uuid");
const store_1 = require("./store");
Object.defineProperty(exports, "store", { enumerable: true, get: function () { return store_1.store; } });
const stateMachine_1 = require("./stateMachine");
const errors_1 = require("./errors");
Object.defineProperty(exports, "errors", { enumerable: true, get: function () { return errors_1.errors; } });
function detectRenewalConflicts(lease) {
    const conflicts = [];
    const now = new Date();
    const endDate = new Date(lease.endDate);
    const autoRenewalThreshold = new Date(endDate);
    autoRenewalThreshold.setDate(endDate.getDate() - lease.renewalRule.autoRenewalDays);
    const autoRenewal = lease.renewalRecords.find(r => r.type === 'auto' && r.status === 'pending');
    const manualRenewal = lease.renewalRecords.find(r => r.type === 'manual' && r.status === 'pending');
    if (autoRenewal && manualRenewal) {
        conflicts.push({
            id: (0, uuid_1.v4)(),
            type: 'auto_vs_manual_renewal',
            status: 'detected',
            severity: 'high',
            description: '自动续租和手动续租同时触发，存在冲突',
            autoRenewalId: autoRenewal.id,
            manualRenewalId: manualRenewal.id,
            detectedAt: now.toISOString()
        });
    }
    if (lease.paymentStatus === 'overdue') {
        conflicts.push({
            id: (0, uuid_1.v4)(),
            type: 'payment_overdue',
            status: 'detected',
            severity: 'high',
            description: '存在逾期未付款项，无法续租',
            detectedAt: now.toISOString()
        });
    }
    if (!lease.renewalRule.isActive) {
        conflicts.push({
            id: (0, uuid_1.v4)(),
            type: 'invalid_renewal_rule',
            status: 'detected',
            severity: 'medium',
            description: '续租规则未激活，需要检查配置',
            detectedAt: now.toISOString()
        });
    }
    return conflicts;
}
function createLeaseService(data) {
    const lease = store_1.store.createLease(data);
    store_1.store.addHistory(lease.id, {
        actionType: 'lease_created',
        actor: data.createdBy || 'system',
        description: '创建租赁记录',
        details: { leaseNo: lease.leaseNo, customerName: lease.customer.name }
    });
    return lease;
}
function submitAutoRenewalService(leaseId, actor) {
    const lease = store_1.store.getLease(leaseId);
    if (!lease) {
        return { success: false, error: errors_1.errors.leaseNotFound(leaseId) };
    }
    const endDate = new Date(lease.endDate);
    const newStartDate = new Date(endDate);
    newStartDate.setDate(endDate.getDate() + 1);
    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newStartDate.getMonth() + lease.renewalRule.newLeaseTerm);
    const newPrice = lease.price * (1 + lease.renewalRule.priceAdjustment / 100);
    const autoRenewal = {
        id: (0, uuid_1.v4)(),
        type: 'auto',
        requestedAt: new Date().toISOString(),
        requestedBy: actor,
        newStartDate: newStartDate.toISOString(),
        newEndDate: newEndDate.toISOString(),
        newPrice,
        status: 'pending'
    };
    const updatedRenewalRecords = [...lease.renewalRecords, autoRenewal];
    let updatedLease = store_1.store.updateLease(leaseId, {
        renewalRecords: updatedRenewalRecords,
        status: 'renewal_pending'
    });
    store_1.store.addHistory(leaseId, {
        actionType: 'auto_renewal_triggered',
        actor,
        description: '触发自动续租流程',
        details: { renewalId: autoRenewal.id, newPrice, newEndDate: newEndDate.toISOString() }
    });
    if (!updatedLease)
        return { success: false };
    const conflicts = detectRenewalConflicts(updatedLease);
    if (conflicts.length > 0) {
        conflicts.forEach(conflict => {
            store_1.store.addConflict(leaseId, conflict);
            store_1.store.addHistory(leaseId, {
                actionType: 'conflict_detected',
                actor: 'system',
                description: `检测到续租冲突: ${conflict.description}`,
                details: { conflictId: conflict.id, conflictType: conflict.type }
            });
        });
        updatedLease = store_1.store.getLease(leaseId);
    }
    return { success: true, lease: updatedLease };
}
function submitManualRenewalService(leaseId, renewalData, actor) {
    const lease = store_1.store.getLease(leaseId);
    if (!lease) {
        return { success: false, error: errors_1.errors.leaseNotFound(leaseId) };
    }
    const manualRenewal = {
        id: (0, uuid_1.v4)(),
        type: 'manual',
        requestedAt: new Date().toISOString(),
        requestedBy: actor,
        newStartDate: renewalData.newStartDate || '',
        newEndDate: renewalData.newEndDate || '',
        newPrice: renewalData.newPrice || lease.price,
        status: 'pending'
    };
    const updatedRenewalRecords = [...lease.renewalRecords, manualRenewal];
    let updatedLease = store_1.store.updateLease(leaseId, {
        renewalRecords: updatedRenewalRecords,
        status: 'renewal_pending'
    });
    store_1.store.addHistory(leaseId, {
        actionType: 'manual_renewal_submitted',
        actor,
        description: '提交手动续租申请',
        details: { renewalId: manualRenewal.id }
    });
    if (!updatedLease)
        return { success: false };
    const conflicts = detectRenewalConflicts(updatedLease);
    if (conflicts.length > 0) {
        conflicts.forEach(conflict => {
            store_1.store.addConflict(leaseId, conflict);
            store_1.store.addHistory(leaseId, {
                actionType: 'conflict_detected',
                actor: 'system',
                description: `检测到续租冲突: ${conflict.description}`,
                details: { conflictId: conflict.id, conflictType: conflict.type }
            });
        });
        updatedLease = store_1.store.getLease(leaseId);
    }
    return { success: true, lease: updatedLease };
}
function addRemarkService(leaseId, content, actor, conflictId) {
    const lease = store_1.store.getLease(leaseId);
    if (!lease) {
        return { success: false, error: errors_1.errors.leaseNotFound(leaseId) };
    }
    const remark = {
        content,
        createdBy: actor,
        conflictId
    };
    const newRemark = store_1.store.addRemark(leaseId, remark);
    store_1.store.addHistory(leaseId, {
        actionType: 'remark_added',
        actor,
        description: '添加处理备注',
        details: { remarkId: newRemark?.id, conflictId }
    });
    const updatedLease = store_1.store.getLease(leaseId);
    return { success: true, lease: updatedLease };
}
function resolveConflictService(leaseId, conflictId, resolution, actor) {
    const lease = store_1.store.getLease(leaseId);
    if (!lease) {
        return { success: false, error: errors_1.errors.leaseNotFound(leaseId) };
    }
    const conflict = lease.conflicts.find(c => c.id === conflictId);
    if (!conflict) {
        return { success: false, error: errors_1.errors.conflictNotFound(conflictId) };
    }
    const hasRemark = lease.remarks.some(r => r.conflictId === conflictId);
    const validation = (0, stateMachine_1.validateConflictResolution)({ hasRemark });
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    store_1.store.updateConflict(leaseId, conflictId, {
        status: 'resolved',
        resolution,
        resolvedAt: new Date().toISOString(),
        resolvedBy: actor
    });
    store_1.store.addHistory(leaseId, {
        actionType: 'conflict_resolved',
        actor,
        description: `解决冲突: ${conflict.description}`,
        details: { conflictId, resolution }
    });
    const updatedLease = store_1.store.getLease(leaseId);
    return { success: true, lease: updatedLease };
}
function transitionStatusService(leaseId, newStatus, actor) {
    const lease = store_1.store.getLease(leaseId);
    if (!lease) {
        return { success: false, error: errors_1.errors.leaseNotFound(leaseId) };
    }
    const unresolvedConflicts = lease.conflicts.filter(c => c.status !== 'resolved').length;
    const context = {
        unresolvedConflicts,
        allConflictsResolved: unresolvedConflicts === 0,
        paymentStatus: lease.paymentStatus,
        hasManualRenewal: lease.renewalRecords.some(r => r.type === 'manual' && r.status === 'pending'),
        autoRenewalEligible: lease.renewalRule.isActive
    };
    const { valid, error } = (0, stateMachine_1.validateTransition)(lease.status, newStatus, context);
    if (!valid) {
        return { success: false, error };
    }
    const updated = store_1.store.updateLease(leaseId, { status: newStatus });
    if (updated) {
        store_1.store.addHistory(leaseId, {
            actionType: 'status_changed',
            actor,
            description: `状态从 ${lease.status} 变更为 ${newStatus}`,
            details: { fromStatus: lease.status, toStatus: newStatus }
        });
    }
    return { success: true, lease: updated };
}
function confirmRenewalService(leaseId, actor) {
    const lease = store_1.store.getLease(leaseId);
    if (!lease) {
        return { success: false, error: errors_1.errors.leaseNotFound(leaseId) };
    }
    const unresolvedConflicts = lease.conflicts.filter(c => c.status !== 'resolved').length;
    if (unresolvedConflicts > 0) {
        return { success: false, error: errors_1.errors.conflictNotResolved(unresolvedConflicts) };
    }
    if (lease.paymentStatus !== 'paid') {
        return { success: false, error: errors_1.errors.paymentRequired() };
    }
    const pendingRenewal = lease.renewalRecords.find(r => r.status === 'pending');
    if (!pendingRenewal) {
        return { success: false };
    }
    const updatedRenewalRecords = lease.renewalRecords.map(r => r.id === pendingRenewal.id ? { ...r, status: 'confirmed' } : r);
    const updatedLease = store_1.store.updateLease(leaseId, {
        renewalRecords: updatedRenewalRecords,
        status: 'renewed',
        startDate: pendingRenewal.newStartDate,
        endDate: pendingRenewal.newEndDate,
        price: pendingRenewal.newPrice
    });
    store_1.store.addHistory(leaseId, {
        actionType: 'status_changed',
        actor,
        description: '续租已确认，租约已更新',
        details: { newEndDate: pendingRenewal.newEndDate, newPrice: pendingRenewal.newPrice }
    });
    return { success: true, lease: updatedLease };
}
function importLeasesService(rows, actor) {
    const badRows = [];
    const leases = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 1;
        if (!row.leaseNo || !row.customer?.name || !row.asset?.name || !row.price) {
            badRows.push({
                rowNumber,
                rawData: JSON.stringify(row),
                errorType: 'MISSING_REQUIRED',
                errorMessage: '缺少 leaseNo、customer.name、asset.name 或 price 字段'
            });
            return;
        }
        if (typeof row.price !== 'number' || row.price <= 0) {
            badRows.push({
                rowNumber,
                rawData: JSON.stringify(row),
                errorType: 'INVALID_PRICE',
                errorMessage: '价格必须为大于0的数字'
            });
            return;
        }
        try {
            const lease = createLeaseService({
                ...row,
                createdBy: actor
            });
            leases.push(lease);
        }
        catch (e) {
            badRows.push({
                rowNumber,
                rawData: JSON.stringify(row),
                errorType: 'CREATE_FAILED',
                errorMessage: '创建租赁记录失败'
            });
        }
    });
    return { success: true, leases, badRows };
}
