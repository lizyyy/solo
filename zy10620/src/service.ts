import { v4 as uuidv4 } from 'uuid';
import { store } from './store';
import { validateTransition, validateConflictResolution } from './stateMachine';
import { errors } from './errors';
import { Lease, RenewalConflict, RenewalRecord, ImportBadRow, LeaseRemark } from './types';

function detectRenewalConflicts(lease: Lease): RenewalConflict[] {
  const conflicts: RenewalConflict[] = [];
  const now = new Date();
  const endDate = new Date(lease.endDate);
  const autoRenewalThreshold = new Date(endDate);
  autoRenewalThreshold.setDate(endDate.getDate() - lease.renewalRule.autoRenewalDays);

  const autoRenewal = lease.renewalRecords.find(r => r.type === 'auto' && r.status === 'pending');
  const manualRenewal = lease.renewalRecords.find(r => r.type === 'manual' && r.status === 'pending');

  if (autoRenewal && manualRenewal) {
    conflicts.push({
      id: uuidv4(),
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
      id: uuidv4(),
      type: 'payment_overdue',
      status: 'detected',
      severity: 'high',
      description: '存在逾期未付款项，无法续租',
      detectedAt: now.toISOString()
    });
  }

  if (!lease.renewalRule.isActive) {
    conflicts.push({
      id: uuidv4(),
      type: 'invalid_renewal_rule',
      status: 'detected',
      severity: 'medium',
      description: '续租规则未激活，需要检查配置',
      detectedAt: now.toISOString()
    });
  }

  return conflicts;
}

export function createLeaseService(data: Partial<Lease>): Lease {
  const lease = store.createLease(data);
  
  store.addHistory(lease.id, {
    actionType: 'lease_created',
    actor: data.createdBy || 'system',
    description: '创建租赁记录',
    details: { leaseNo: lease.leaseNo, customerName: lease.customer.name }
  });

  return lease;
}

export function submitAutoRenewalService(
  leaseId: string,
  actor: string
): { success: boolean; lease?: Lease; error?: any } {
  const lease = store.getLease(leaseId);
  if (!lease) {
    return { success: false, error: errors.leaseNotFound(leaseId) };
  }

  const endDate = new Date(lease.endDate);
  const newStartDate = new Date(endDate);
  newStartDate.setDate(endDate.getDate() + 1);
  const newEndDate = new Date(newStartDate);
  newEndDate.setMonth(newStartDate.getMonth() + lease.renewalRule.newLeaseTerm);
  const newPrice = lease.price * (1 + lease.renewalRule.priceAdjustment / 100);

  const autoRenewal: RenewalRecord = {
    id: uuidv4(),
    type: 'auto',
    requestedAt: new Date().toISOString(),
    requestedBy: actor,
    newStartDate: newStartDate.toISOString(),
    newEndDate: newEndDate.toISOString(),
    newPrice,
    status: 'pending'
  };

  const updatedRenewalRecords = [...lease.renewalRecords, autoRenewal];
  let updatedLease = store.updateLease(leaseId, { 
    renewalRecords: updatedRenewalRecords,
    status: 'renewal_pending'
  });

  store.addHistory(leaseId, {
    actionType: 'auto_renewal_triggered',
    actor,
    description: '触发自动续租流程',
    details: { renewalId: autoRenewal.id, newPrice, newEndDate: newEndDate.toISOString() }
  });

  if (!updatedLease) return { success: false };

  const conflicts = detectRenewalConflicts(updatedLease);
  if (conflicts.length > 0) {
    conflicts.forEach(conflict => {
      store.addConflict(leaseId, conflict);
      store.addHistory(leaseId, {
        actionType: 'conflict_detected',
        actor: 'system',
        description: `检测到续租冲突: ${conflict.description}`,
        details: { conflictId: conflict.id, conflictType: conflict.type }
      });
    });
    updatedLease = store.getLease(leaseId);
  }

  return { success: true, lease: updatedLease };
}

export function submitManualRenewalService(
  leaseId: string,
  renewalData: Partial<RenewalRecord>,
  actor: string
): { success: boolean; lease?: Lease; error?: any } {
  const lease = store.getLease(leaseId);
  if (!lease) {
    return { success: false, error: errors.leaseNotFound(leaseId) };
  }

  const manualRenewal: RenewalRecord = {
    id: uuidv4(),
    type: 'manual',
    requestedAt: new Date().toISOString(),
    requestedBy: actor,
    newStartDate: renewalData.newStartDate || '',
    newEndDate: renewalData.newEndDate || '',
    newPrice: renewalData.newPrice || lease.price,
    status: 'pending'
  };

  const updatedRenewalRecords = [...lease.renewalRecords, manualRenewal];
  let updatedLease = store.updateLease(leaseId, { 
    renewalRecords: updatedRenewalRecords,
    status: 'renewal_pending'
  });

  store.addHistory(leaseId, {
    actionType: 'manual_renewal_submitted',
    actor,
    description: '提交手动续租申请',
    details: { renewalId: manualRenewal.id }
  });

  if (!updatedLease) return { success: false };

  const conflicts = detectRenewalConflicts(updatedLease);
  if (conflicts.length > 0) {
    conflicts.forEach(conflict => {
      store.addConflict(leaseId, conflict);
      store.addHistory(leaseId, {
        actionType: 'conflict_detected',
        actor: 'system',
        description: `检测到续租冲突: ${conflict.description}`,
        details: { conflictId: conflict.id, conflictType: conflict.type }
      });
    });
    updatedLease = store.getLease(leaseId);
  }

  return { success: true, lease: updatedLease };
}

export function addRemarkService(
  leaseId: string,
  content: string,
  actor: string,
  conflictId?: string
): { success: boolean; lease?: Lease; error?: any } {
  const lease = store.getLease(leaseId);
  if (!lease) {
    return { success: false, error: errors.leaseNotFound(leaseId) };
  }

  const remark: Omit<LeaseRemark, 'id' | 'createdAt'> = {
    content,
    createdBy: actor,
    conflictId
  };

  const newRemark = store.addRemark(leaseId, remark);

  store.addHistory(leaseId, {
    actionType: 'remark_added',
    actor,
    description: '添加处理备注',
    details: { remarkId: newRemark?.id, conflictId }
  });

  const updatedLease = store.getLease(leaseId);
  return { success: true, lease: updatedLease };
}

export function resolveConflictService(
  leaseId: string,
  conflictId: string,
  resolution: string,
  actor: string
): { success: boolean; lease?: Lease; error?: any } {
  const lease = store.getLease(leaseId);
  if (!lease) {
    return { success: false, error: errors.leaseNotFound(leaseId) };
  }

  const conflict = lease.conflicts.find(c => c.id === conflictId);
  if (!conflict) {
    return { success: false, error: errors.conflictNotFound(conflictId) };
  }

  const hasRemark = lease.remarks.some(r => r.conflictId === conflictId);
  const validation = validateConflictResolution({ hasRemark });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  store.updateConflict(leaseId, conflictId, {
    status: 'resolved',
    resolution,
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor
  });

  store.addHistory(leaseId, {
    actionType: 'conflict_resolved',
    actor,
    description: `解决冲突: ${conflict.description}`,
    details: { conflictId, resolution }
  });

  const updatedLease = store.getLease(leaseId);
  return { success: true, lease: updatedLease };
}

export function transitionStatusService(
  leaseId: string,
  newStatus: any,
  actor: string
): { success: boolean; lease?: Lease; error?: any } {
  const lease = store.getLease(leaseId);
  if (!lease) {
    return { success: false, error: errors.leaseNotFound(leaseId) };
  }

  const unresolvedConflicts = lease.conflicts.filter(c => c.status !== 'resolved').length;

  const context = {
    unresolvedConflicts,
    allConflictsResolved: unresolvedConflicts === 0,
    paymentStatus: lease.paymentStatus,
    hasManualRenewal: lease.renewalRecords.some(r => r.type === 'manual' && r.status === 'pending'),
    autoRenewalEligible: lease.renewalRule.isActive
  };

  const { valid, error } = validateTransition(lease.status, newStatus, context);
  if (!valid) {
    return { success: false, error };
  }

  const updated = store.updateLease(leaseId, { status: newStatus });
  
  if (updated) {
    store.addHistory(leaseId, {
      actionType: 'status_changed',
      actor,
      description: `状态从 ${lease.status} 变更为 ${newStatus}`,
      details: { fromStatus: lease.status, toStatus: newStatus }
    });
  }

  return { success: true, lease: updated };
}

export function confirmRenewalService(
  leaseId: string,
  actor: string
): { success: boolean; lease?: Lease; error?: any } {
  const lease = store.getLease(leaseId);
  if (!lease) {
    return { success: false, error: errors.leaseNotFound(leaseId) };
  }

  const unresolvedConflicts = lease.conflicts.filter(c => c.status !== 'resolved').length;
  if (unresolvedConflicts > 0) {
    return { success: false, error: errors.conflictNotResolved(unresolvedConflicts) };
  }

  if (lease.paymentStatus !== 'paid') {
    return { success: false, error: errors.paymentRequired() };
  }

  const pendingRenewal = lease.renewalRecords.find(r => r.status === 'pending');
  if (!pendingRenewal) {
    return { success: false };
  }

  const updatedRenewalRecords = lease.renewalRecords.map(r =>
    r.id === pendingRenewal.id ? { ...r, status: 'confirmed' as const } : r
  );

  const updatedLease = store.updateLease(leaseId, {
    renewalRecords: updatedRenewalRecords,
    status: 'renewed',
    startDate: pendingRenewal.newStartDate,
    endDate: pendingRenewal.newEndDate,
    price: pendingRenewal.newPrice
  });

  store.addHistory(leaseId, {
    actionType: 'status_changed',
    actor,
    description: '续租已确认，租约已更新',
    details: { newEndDate: pendingRenewal.newEndDate, newPrice: pendingRenewal.newPrice }
  });

  return { success: true, lease: updatedLease };
}

export function importLeasesService(
  rows: any[],
  actor: string
): { success: boolean; leases?: Lease[]; badRows?: ImportBadRow[] } {
  const badRows: ImportBadRow[] = [];
  const leases: Lease[] = [];

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
    } catch (e) {
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

export { store, errors };
