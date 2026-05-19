const { v4: uuidv4 } = require('uuid');
const store = require('../storage/store');

const LeaseStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  REJECTED: 'REJECTED',
  PENDING_RENEWAL: 'PENDING_RENEWAL'
};

const ApprovalStrategy = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL'
};

const RenewalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

class LeaseService {
  createLease(applicant, resourceId, durationHours, approvalStrategy = ApprovalStrategy.AUTO, reason = '', operator = 'USER') {
    try {
      const leases = store.readLeases();
      
      const existingActiveLease = leases.find(
        l => l.applicant === applicant && l.resourceId === resourceId && 
        (l.status === LeaseStatus.ACTIVE || l.status === LeaseStatus.PENDING_APPROVAL || l.status === LeaseStatus.PENDING_RENEWAL)
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
        pendingRenewalId: null
      };
      
      leases.push(lease);
      store.writeLeases(leases);
      
      this.logAudit('LEASE_CREATED', lease.id, { 
        input: { applicant, resourceId, durationHours, approvalStrategy, reason },
        result: 'success',
        operator 
      });
      
      return lease;
    } catch (error) {
      this.logAudit('LEASE_CREATE_FAILED', null, {
        input: { applicant, resourceId, durationHours, approvalStrategy, reason },
        result: 'failed',
        error: error.message,
        operator
      });
      throw error;
    }
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
    try {
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
      
      this.logAudit('LEASE_APPROVED', leaseId, { 
        input: { approver, comment },
        result: 'success',
        operator: approver 
      });
      
      return lease;
    } catch (error) {
      this.logAudit('LEASE_APPROVE_FAILED', leaseId, {
        input: { approver, comment },
        result: 'failed',
        error: error.message,
        operator: approver
      });
      throw error;
    }
  }

  rejectLease(leaseId, rejector, reason = '') {
    try {
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
      
      this.logAudit('LEASE_REJECTED', leaseId, { 
        input: { rejector, reason },
        result: 'success',
        operator: rejector 
      });
      
      return lease;
    } catch (error) {
      this.logAudit('LEASE_REJECT_FAILED', leaseId, {
        input: { rejector, reason },
        result: 'failed',
        error: error.message,
        operator: rejector
      });
      throw error;
    }
  }

  requestRenewal(leaseId, durationHours, applicant, reason = '') {
    try {
      const leases = store.readLeases();
      const lease = leases.find(l => l.id === leaseId);
      
      if (!lease) {
        throw new Error('租约不存在');
      }
      
      if (lease.status !== LeaseStatus.ACTIVE) {
        throw new Error('只有活跃租约才能申请续租');
      }

      if (lease.pendingRenewalId) {
        throw new Error('该租约已有待审批的续租申请');
      }

      const renewalRequest = {
        id: uuidv4(),
        leaseId,
        durationHours,
        applicant,
        reason,
        status: RenewalStatus.PENDING,
        requestedAt: new Date().toISOString()
      };

      const renewals = store.readRenewals();
      renewals.push(renewalRequest);
      store.writeRenewals(renewals);

      lease.pendingRenewalId = renewalRequest.id;
      lease.status = LeaseStatus.PENDING_RENEWAL;
      store.writeLeases(leases);

      this.logAudit('RENEWAL_REQUESTED', leaseId, {
        input: { durationHours, applicant, reason },
        result: 'success',
        renewalId: renewalRequest.id,
        operator: applicant
      });

      return { lease, renewalRequest };
    } catch (error) {
      this.logAudit('RENEWAL_REQUEST_FAILED', leaseId, {
        input: { durationHours, applicant, reason },
        result: 'failed',
        error: error.message,
        operator: applicant
      });
      throw error;
    }
  }

  approveRenewal(renewalId, approver, comment = '') {
    try {
      const renewals = store.readRenewals();
      const renewal = renewals.find(r => r.id === renewalId);

      if (!renewal) {
        throw new Error('续租申请不存在');
      }

      if (renewal.status !== RenewalStatus.PENDING) {
        throw new Error('该续租申请已处理');
      }

      const leases = store.readLeases();
      const lease = leases.find(l => l.id === renewal.leaseId);

      if (!lease) {
        throw new Error('关联租约不存在');
      }

      const originalExpiresAt = lease.expiresAt;
      const newExpiresAt = new Date(new Date(lease.expiresAt).getTime() + renewal.durationHours * 60 * 60 * 1000).toISOString();
      lease.expiresAt = newExpiresAt;
      lease.lastRenewedAt = new Date().toISOString();
      lease.pendingRenewalId = null;
      lease.status = LeaseStatus.ACTIVE;
      store.writeLeases(leases);

      renewal.status = RenewalStatus.APPROVED;
      renewal.approvedBy = approver;
      renewal.comment = comment;
      renewal.approvedAt = new Date().toISOString();
      renewal.originalExpiresAt = originalExpiresAt;
      renewal.newExpiresAt = newExpiresAt;
      store.writeRenewals(renewals);

      this.logAudit('RENEWAL_APPROVED', renewal.leaseId, {
        input: { renewalId, approver, comment },
        result: 'success',
        originalExpiresAt,
        newExpiresAt,
        durationHours: renewal.durationHours,
        operator: approver
      });

      return { lease, renewal };
    } catch (error) {
      this.logAudit('RENEWAL_APPROVE_FAILED', null, {
        input: { renewalId, approver, comment },
        result: 'failed',
        error: error.message,
        operator: approver
      });
      throw error;
    }
  }

  rejectRenewal(renewalId, rejector, reason = '') {
    try {
      const renewals = store.readRenewals();
      const renewal = renewals.find(r => r.id === renewalId);

      if (!renewal) {
        throw new Error('续租申请不存在');
      }

      if (renewal.status !== RenewalStatus.PENDING) {
        throw new Error('该续租申请已处理');
      }

      const leases = store.readLeases();
      const lease = leases.find(l => l.id === renewal.leaseId);

      if (lease) {
        lease.pendingRenewalId = null;
        lease.status = LeaseStatus.ACTIVE;
        store.writeLeases(leases);
      }

      renewal.status = RenewalStatus.REJECTED;
      renewal.rejectedBy = rejector;
      renewal.rejectReason = reason;
      renewal.rejectedAt = new Date().toISOString();
      store.writeRenewals(renewals);

      this.logAudit('RENEWAL_REJECTED', renewal.leaseId, {
        input: { renewalId, rejector, reason },
        result: 'success',
        operator: rejector
      });

      return { lease, renewal };
    } catch (error) {
      this.logAudit('RENEWAL_REJECT_FAILED', null, {
        input: { renewalId, rejector, reason },
        result: 'failed',
        error: error.message,
        operator: rejector
      });
      throw error;
    }
  }

  renewLease(leaseId, durationHours, operator = 'SYSTEM') {
    try {
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
        renewedAt: new Date().toISOString(),
        status: 'APPROVED',
        approvedBy: operator
      });
      store.writeRenewals(renewals);
      
      this.logAudit('LEASE_RENEWED', leaseId, { 
        input: { durationHours },
        result: 'success',
        originalExpiresAt, 
        newExpiresAt, 
        durationHours,
        operator 
      });
      
      return lease;
    } catch (error) {
      this.logAudit('LEASE_RENEW_FAILED', leaseId, {
        input: { durationHours },
        result: 'failed',
        error: error.message,
        operator
      });
      throw error;
    }
  }

  revokeLease(leaseId, operator, reason = '') {
    try {
      const leases = store.readLeases();
      const lease = leases.find(l => l.id === leaseId);
      
      if (!lease) {
        throw new Error('租约不存在');
      }
      
      if (lease.status !== LeaseStatus.ACTIVE && lease.status !== LeaseStatus.PENDING_RENEWAL) {
        throw new Error('只有活跃或待续租的租约才能吊销');
      }
      
      lease.status = LeaseStatus.REVOKED;
      lease.pendingRenewalId = null;
      
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
      
      this.logAudit('LEASE_REVOKED', leaseId, { 
        input: { operator, reason },
        result: 'success',
        operator 
      });
      
      return lease;
    } catch (error) {
      this.logAudit('LEASE_REVOKE_FAILED', leaseId, {
        input: { operator, reason },
        result: 'failed',
        error: error.message,
        operator
      });
      throw error;
    }
  }

  checkExpiredLeases() {
    try {
      const leases = store.readLeases();
      const now = new Date();
      let expiredCount = 0;
      
      leases.forEach(lease => {
        if ((lease.status === LeaseStatus.ACTIVE || lease.status === LeaseStatus.PENDING_RENEWAL) 
            && new Date(lease.expiresAt) <= now) {
          lease.status = LeaseStatus.EXPIRED;
          lease.pendingRenewalId = null;
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
          
          this.logAudit('LEASE_EXPIRED', lease.id, { 
            expiredAt: lease.expiresAt,
            operator: 'SYSTEM'
          });
        }
      });
      
      if (expiredCount > 0) {
        store.writeLeases(leases);
      }
      
      return expiredCount;
    } catch (error) {
      this.logAudit('EXPIRED_CHECK_FAILED', null, {
        result: 'failed',
        error: error.message,
        operator: 'SYSTEM'
      });
      throw error;
    }
  }

  validateLease(secretToken, resourceId, operator = 'API_CALLER') {
    try {
      this.checkExpiredLeases();
      
      const leases = store.readLeases();
      const lease = leases.find(l => l.secretToken === secretToken && l.resourceId === resourceId);
      
      if (!lease) {
        this.logAudit('LEASE_VALIDATE_FAILED', null, {
          input: { secretToken, resourceId },
          result: 'failed',
          error: '无效的密钥或资源不匹配',
          operator
        });
        return { valid: false, reason: '无效的密钥或资源不匹配' };
      }
      
      if (lease.status !== LeaseStatus.ACTIVE) {
        this.logAudit('LEASE_VALIDATE_FAILED', lease.id, {
          input: { secretToken, resourceId },
          result: 'failed',
          error: `租约状态: ${lease.status}`,
          operator
        });
        return { valid: false, reason: `租约状态: ${lease.status}` };
      }
      
      this.logAudit('LEASE_VALIDATED', lease.id, { 
        input: { secretToken, resourceId },
        result: 'success',
        valid: true,
        operator 
      });
      
      return { valid: true, lease };
    } catch (error) {
      this.logAudit('LEASE_VALIDATE_FAILED', null, {
        input: { secretToken, resourceId },
        result: 'failed',
        error: error.message,
        operator
      });
      return { valid: false, reason: error.message };
    }
  }

  getLeaseHistory(leaseId) {
    return {
      approvals: store.readApprovals().filter(a => a.leaseId === leaseId),
      renewals: store.readRenewals().filter(r => r.leaseId === leaseId),
      invalidations: store.readInvalidations().filter(i => i.leaseId === leaseId),
      auditLogs: store.readAuditLogs().filter(l => l.leaseId === leaseId)
    };
  }

  getPendingRenewals() {
    return store.readRenewals().filter(r => r.status === RenewalStatus.PENDING);
  }

  getInvalidations() {
    return store.readInvalidations().sort((a, b) => new Date(b.invalidatedAt) - new Date(a.invalidatedAt));
  }

  getRenewalById(renewalId) {
    return store.readRenewals().find(r => r.id === renewalId);
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
  ApprovalStrategy,
  RenewalStatus
};
