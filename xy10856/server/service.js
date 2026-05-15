const { v4: uuidv4 } = require('uuid');
const storage = require('./storage');

const INVITATION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  USED: 'used',
  REVOKED: 'revoked',
  EXPIRED: 'expired'
};

const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

function createAuditLog(action, operator, input, result, status) {
  const audit = {
    id: uuidv4(),
    action,
    operator,
    input,
    result,
    status,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
  storage.insert('audit', audit);
  return audit;
}

function isDomainAllowed(email) {
  const domains = storage.readData('domains');
  if (domains.length === 0) return true;
  const emailDomain = email.split('@')[1]?.toLowerCase();
  return domains.some(d => d.domain.toLowerCase() === emailDomain && d.enabled);
}

function createInvitation(inviterEmail, inviteeEmail, roleId, projectId, operator) {
  const roles = storage.readData('roles');
  const role = roles.find(r => r.id === roleId);
  if (!role) {
    const result = { success: false, error: 'ROLE_NOT_FOUND', message: '角色不存在' };
    createAuditLog('create_invitation', operator, { inviterEmail, inviteeEmail, roleId, projectId }, result, 'error');
    return result;
  }

  const existing = storage.readData('invitations').find(
    i => i.inviteeEmail.toLowerCase() === inviteeEmail.toLowerCase() && 
         i.projectId === projectId && 
         [INVITATION_STATUS.PENDING, INVITATION_STATUS.ACTIVE].includes(i.status)
  );

  if (existing) {
    const result = { success: false, error: 'DUPLICATE_INVITATION', message: '该用户已有有效邀请', invitationId: existing.id };
    createAuditLog('create_invitation', operator, { inviterEmail, inviteeEmail, roleId, projectId }, result, 'error');
    return result;
  }

  const domainAllowed = isDomainAllowed(inviteeEmail);
  const requiresApproval = !domainAllowed;

  const invitation = {
    id: uuidv4(),
    inviterEmail,
    inviteeEmail,
    roleId,
    roleName: role.name,
    projectId,
    status: requiresApproval ? INVITATION_STATUS.PENDING : INVITATION_STATUS.ACTIVE,
    requiresApproval,
    token: uuidv4(),
    maxUses: 1,
    usedCount: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  storage.insert('invitations', invitation);

  if (requiresApproval) {
    const approval = {
      id: uuidv4(),
      invitationId: invitation.id,
      requesterEmail: inviterEmail,
      inviteeEmail,
      reason: '邮箱域名不在白名单内，需要审批',
      status: APPROVAL_STATUS.PENDING,
      createdAt: new Date().toISOString()
    };
    storage.insert('approvals', approval);
  }

  const result = { success: true, data: invitation };
  createAuditLog('create_invitation', operator, { inviterEmail, inviteeEmail, roleId, projectId }, result, 'success');
  return result;
}

function getInvitations(filters = {}) {
  let invitations = storage.readData('invitations');
  
  if (filters.status) {
    invitations = invitations.filter(i => i.status === filters.status);
  }
  if (filters.projectId) {
    invitations = invitations.filter(i => i.projectId === filters.projectId);
  }
  if (filters.search) {
    const search = filters.search.toLowerCase();
    invitations = invitations.filter(i => 
      i.inviteeEmail.toLowerCase().includes(search) ||
      i.inviterEmail.toLowerCase().includes(search)
    );
  }
  
  return { success: true, data: invitations };
}

function getInvitationById(id) {
  const invitation = storage.findById('invitations', id);
  if (!invitation) {
    return { success: false, error: 'NOT_FOUND', message: '邀请不存在' };
  }
  return { success: true, data: invitation };
}

function useInvitation(token, userEmail, operator) {
  const invitations = storage.readData('invitations');
  const invitation = invitations.find(i => i.token === token);
  
  if (!invitation) {
    const result = { success: false, error: 'NOT_FOUND', message: '邀请链接无效' };
    createAuditLog('use_invitation', operator, { token, userEmail }, result, 'error');
    return result;
  }

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    const result = { success: false, error: 'REVOKED', message: '邀请已被撤销' };
    createAuditLog('use_invitation', operator, { token, userEmail }, result, 'error');
    return result;
  }

  if (invitation.status === INVITATION_STATUS.USED) {
    const result = { success: false, error: 'ALREADY_USED', message: '邀请已被使用' };
    createAuditLog('use_invitation', operator, { token, userEmail }, result, 'error');
    return result;
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    storage.update('invitations', invitation.id, { status: INVITATION_STATUS.EXPIRED });
    const result = { success: false, error: 'EXPIRED', message: '邀请已过期' };
    createAuditLog('use_invitation', operator, { token, userEmail }, result, 'error');
    return result;
  }

  if (invitation.status === INVITATION_STATUS.PENDING) {
    const result = { success: false, error: 'PENDING_APPROVAL', message: '邀请正在等待审批' };
    createAuditLog('use_invitation', operator, { token, userEmail }, result, 'error');
    return result;
  }

  if (invitation.inviteeEmail.toLowerCase() !== userEmail.toLowerCase()) {
    const result = { success: false, error: 'EMAIL_MISMATCH', message: '只能由受邀邮箱使用' };
    createAuditLog('use_invitation', operator, { token, userEmail }, result, 'error');
    return result;
  }

  const usedCount = invitation.usedCount + 1;
  const newStatus = usedCount >= invitation.maxUses ? INVITATION_STATUS.USED : invitation.status;
  
  storage.update('invitations', invitation.id, {
    usedCount,
    status: newStatus,
    lastUsedAt: new Date().toISOString()
  });

  const usage = {
    id: uuidv4(),
    invitationId: invitation.id,
    userEmail,
    usedAt: new Date().toISOString(),
    ipAddress: operator?.ip || 'unknown'
  };
  storage.insert('usages', usage);

  const result = { success: true, data: { invitation, usage } };
  createAuditLog('use_invitation', operator, { token, userEmail }, result, 'success');
  return result;
}

function revokeInvitation(invitationId, reason, operator) {
  const invitation = storage.findById('invitations', invitationId);
  if (!invitation) {
    const result = { success: false, error: 'NOT_FOUND', message: '邀请不存在' };
    createAuditLog('revoke_invitation', operator, { invitationId, reason }, result, 'error');
    return result;
  }

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    const result = { success: false, error: 'ALREADY_REVOKED', message: '邀请已被撤销' };
    createAuditLog('revoke_invitation', operator, { invitationId, reason }, result, 'error');
    return result;
  }

  storage.update('invitations', invitationId, { status: INVITATION_STATUS.REVOKED });

  const revocation = {
    id: uuidv4(),
    invitationId,
    reason,
    revokedBy: operator,
    revokedAt: new Date().toISOString()
  };
  storage.insert('revocations', revocation);

  const result = { success: true, data: { invitation, revocation } };
  createAuditLog('revoke_invitation', operator, { invitationId, reason }, result, 'success');
  return result;
}

function processApproval(approvalId, action, approver, reason) {
  const approval = storage.findById('approvals', approvalId);
  if (!approval) {
    const result = { success: false, error: 'NOT_FOUND', message: '审批不存在' };
    createAuditLog('process_approval', approver, { approvalId, action }, result, 'error');
    return result;
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    const result = { success: false, error: 'ALREADY_PROCESSED', message: '审批已处理' };
    createAuditLog('process_approval', approver, { approvalId, action }, result, 'error');
    return result;
  }

  const newStatus = action === 'approve' ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;
  storage.update('approvals', approvalId, {
    status: newStatus,
    approver,
    approvedAt: new Date().toISOString(),
    approvalReason: reason
  });

  if (action === 'approve') {
    storage.update('invitations', approval.invitationId, { status: INVITATION_STATUS.ACTIVE });
  } else {
    storage.update('invitations', approval.invitationId, { status: INVITATION_STATUS.REVOKED });
  }

  const result = { success: true, data: approval };
  createAuditLog('process_approval', approver, { approvalId, action, reason }, result, 'success');
  return result;
}

function getAuditLogs(filters = {}) {
  let logs = storage.readData('audit');
  if (filters.action) {
    logs = logs.filter(l => l.action === filters.action);
  }
  if (filters.status) {
    logs = logs.filter(l => l.status === filters.status);
  }
  return { success: true, data: logs };
}

function exportAllData() {
  return {
    success: true,
    data: {
      invitations: storage.readData('invitations'),
      roles: storage.readData('roles'),
      domains: storage.readData('domains'),
      approvals: storage.readData('approvals'),
      usages: storage.readData('usages'),
      revocations: storage.readData('revocations'),
      audit: storage.readData('audit'),
      exportedAt: new Date().toISOString()
    }
  };
}

function getDashboardStats() {
  const invitations = storage.readData('invitations');
  const approvals = storage.readData('approvals');
  const usages = storage.readData('usages');
  const revocations = storage.readData('revocations');

  return {
    success: true,
    data: {
      total: invitations.length,
      active: invitations.filter(i => i.status === INVITATION_STATUS.ACTIVE).length,
      pending: invitations.filter(i => i.status === INVITATION_STATUS.PENDING).length,
      used: invitations.filter(i => i.status === INVITATION_STATUS.USED).length,
      revoked: invitations.filter(i => i.status === INVITATION_STATUS.REVOKED).length,
      pendingApprovals: approvals.filter(a => a.status === APPROVAL_STATUS.PENDING).length,
      totalUsages: usages.length,
      totalRevocations: revocations.length
    }
  };
}

function getApprovals(filters = {}) {
  let approvals = storage.readData('approvals');
  if (filters.status) {
    approvals = approvals.filter(a => a.status === filters.status);
  }
  return { success: true, data: approvals };
}

function getRoles() {
  return { success: true, data: storage.readData('roles') };
}

function getDomains() {
  return { success: true, data: storage.readData('domains') };
}

function addDomain(domain, operator) {
  const domains = storage.readData('domains');
  if (domains.some(d => d.domain.toLowerCase() === domain.toLowerCase())) {
    const result = { success: false, error: 'DUPLICATE_DOMAIN', message: '域名已存在' };
    createAuditLog('add_domain', operator, { domain }, result, 'error');
    return result;
  }

  const newDomain = {
    id: uuidv4(),
    domain: domain.toLowerCase(),
    enabled: true,
    createdAt: new Date().toISOString()
  };
  storage.insert('domains', newDomain);

  const result = { success: true, data: newDomain };
  createAuditLog('add_domain', operator, { domain }, result, 'success');
  return result;
}

module.exports = {
  createInvitation,
  getInvitations,
  getInvitationById,
  useInvitation,
  revokeInvitation,
  processApproval,
  getAuditLogs,
  exportAllData,
  getDashboardStats,
  getApprovals,
  getRoles,
  getDomains,
  addDomain,
  INVITATION_STATUS,
  APPROVAL_STATUS
};
