const { v4: uuidv4 } = require('uuid');
const store = require('../storage/store');

const LeaseStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  REJECTED: 'REJECTED'
};

const ApprovalStrategy = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL'
};

class LeaseService {
  createLease(applicant, resourceId, durationHours, approvalStrategy = ApprovalStrategy.AUTO, reason = '') {
    const leases = store.readLeases();
    
    const existingActiveLease = leases.find(
      l => l.applicant === applicant && l.resourceId === resourceId && 
      (l.status === LeaseStatus.ACTIVE || l.status === LeaseStatus.PENDING_APPROVAL)
    );
    
    if (existingActiveLease) {
      throw new Error(`该申请人已有此资源的有效或待审批租约`);
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    
    const lease = {
      id: uuidv4(),
      applicant,
      resourceId,
      durationHours,
      approvalStrategy,
      reason,
      status: approvalStrategy === ApprovalStrategy.AUTO ? LeaseStatus.ACTIVE : LeaseStatus.PENDING_APPROVAL,
      secretToken: this.generateSecret(),
      createdAt: now,
      expiresAt,
      lastRenewedAt: null,
      approvedAt: approvalStrategy === ApprovalStrategy.AUTO ? now : null,
      approvedBy: approvalStrategy === ApprovalStrategy.AUTO ? 'SYSTEM' : null,
      createdAt: now
    };
    
    leases.push(lease);
    store.writeLeases(leases);
    
    this.logAudit('LEASE_CREATED', lease.id, { applicant, resourceId, durationHours });
    
    return lease;
  }

  generateSecret() {
    return 'lt_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  getLeases(filters = {}) {
    let leases = store.readLeases();
    
    if (filters.applicant) {
      leases = leases.filter(l => l.applicant.includes(filters.applicant));
    }
    if (filters.resourceId) {
      leases = leases.filter(l => l.resourceId.includes(filters.resourceId));
    }
    if (filters.status) {
      leases = leases.filter(l => l.status === filters.status);
    }
    
    return leases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getLeaseById(id) {
    const leases = store.readLeases();
    return leases.find(l => l.id === id);
  }

  approveLease(leaseId, approver, comment = '') {
    const leases = store.readLeases();
    const lease = leases.find(l => l.id === leaseId);
    
    if (!lease) {
      throw new Error('租约不存在');
    }
    
    if (lease.status !== LeaseStatus.PENDING_APPROVAL) {
      throw new Error('租约状态不是待审批');
    }
    
    lease.status = LeaseStatus.ACTIVE;
    lease.approvedAt = new Date().toISOString();
    lease.approvedBy = approver;
    
    store.writeLeases(leases);
    
    const approvals = store.readApprovals();
    approvals.push({
      id: uuidv4(),
      leaseId,
      approver,
      comment,
      approvedAt: new Date().toISOString()
    });
    store.writeApprovals(approvals);
    
    this.logAudit('LEASE_APPROVED', leaseId, { approver, comment });
    
    return lease;
  }

  rejectLease(leaseId, rejector, reason = '') {
    const leases = store.readLeases();
    const lease = leases.find(l => l.id === leaseId);
    
    if (!lease) {
      throw new Error('租约不存在');
    }
    
    if (lease.status !== LeaseStatus.PENDING_APPROVAL) {
      throw new Error('租约状态不是待审批');
    }
    
    lease.status = LeaseStatus.REJECTED;
    
    store.writeLeases(leases);
    
    this.logAudit('LEASE_REJECTED', leaseId, { rejector, reason });
    
    return lease;
  }

  renewLease(leaseId, durationHours) {
    const leases = store.readLeases();
    const lease = leases.find(l => l.id === leaseId);
    
    if (!lease) {
      throw new Error('租约不存在');
    }
    
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new Error('只有活跃租约才能续租');
    }
    
    const originalExpiresAt = lease.expiresAt;
    const newExpiresAt = new Date(new Date(lease.expiresAt).getTime() + durationHours * 60 * 60 * 1000).toISOString();
    lease.expiresAt = newExpiresAt;
    lease.lastRenewedAt = new Date().toISOString();
    
    store.writeLeases(leases);
    
    const renewals = store.readRenewals();
    renewals.push({
      id: uuidv4(),
      leaseId,
      originalExpiresAt,
      newExpiresAt,
      durationHours,
      renewedAt: new Date().toISOString()
    });
    store.writeRenewals(renewals);
    
    this.logAudit('LEASE_RENEWED', leaseId, { originalExpiresAt, newExpiresAt, durationHours });
    
    return lease;
  }

  revokeLease(leaseId, operator, reason = '') {
    const leases = store.readLeases();
    const lease = leases.find(l => l.id === leaseId);
    
    if (!lease) {
      throw new Error('租约不存在');
    }
    
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new Error('只有活跃租约才能吊销');
    }
    
    lease.status = LeaseStatus.REVOKED;
    
    store.writeLeases(leases);
    
    const invalidations = store.readInvalidations();
    invalidations.push({
      id: uuidv4(),
      leaseId,
      type: 'REVOCATION',
      operator,
      reason,
      invalidatedAt: new Date().toISOString()
    });
    store.writeInvalidations(invalidations);
    
    this.logAudit('LEASE_REVOKED', leaseId, { operator, reason });
    
    return lease;
  }

  checkExpiredLeases() {
    const leases = store.readLeases();
    const now = new Date();
    let expiredCount = 0;
    
    leases.forEach(lease => {
      if (lease.status === LeaseStatus.ACTIVE && new Date(lease.expiresAt) <= now) {
        lease.status = LeaseStatus.EXPIRED;
        expiredCount++;
        
        const invalidations = store.readInvalidations();
        invalidations.push({
          id: uuidv4(),
          leaseId: lease.id,
          type: 'EXPIRATION',
          operator: 'SYSTEM',
          reason: '租约自然到期',
          invalidatedAt: new Date().toISOString()
        });
        store.writeInvalidations(invalidations);
        
        this.logAudit('LEASE_EXPIRED', lease.id, { expiredAt: lease.expiresAt });
      }
    });
    
    if (expiredCount > 0) {
      store.writeLeases(leases);
    }
    
    return expiredCount;
  }

  validateLease(secretToken, resourceId) {
    this.checkExpiredLeases();
    
    const leases = store.readLeases();
    const lease = leases.find(l => l.secretToken === secretToken && l.resourceId === resourceId);
    
    if (!lease) {
      return { valid: false, reason: '无效的密钥或资源不匹配' };
    }
    
    if (lease.status !== LeaseStatus.ACTIVE) {
      return { valid: false, reason: `租约状态: ${lease.status}` };
    }
    
    this.logAudit('LEASE_VALIDATED', lease.id, { valid: true });
    
    return { valid: true, lease };
  }

  getLeaseHistory(leaseId) {
    return {
      approvals: store.readApprovals().filter(a => a.leaseId === leaseId),
      renewals: store.readRenewals().filter(r => r.leaseId === leaseId),
      invalidations: store.readInvalidations().filter(i => i.leaseId === leaseId),
      auditLogs: store.readAuditLogs().filter(l => l.leaseId === leaseId)
    };
  }

  logAudit(action, leaseId, details = {}) {
    const logs = store.readAuditLogs();
    logs.push({
      id: uuidv4(),
      action,
      leaseId,
      details,
      timestamp: new Date().toISOString()
    });
    store.writeAuditLogs(logs);
  }

  exportLeases() {
    const leases = store.readLeases();
    return leases.map(lease => ({
      ...lease,
      history: this.getLeaseHistory(lease.id)
    }));
  }

  getAuditLogs() {
    return store.readAuditLogs().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

module.exports = {
  LeaseService: new LeaseService(),
  LeaseStatus,
  ApprovalStrategy
};
