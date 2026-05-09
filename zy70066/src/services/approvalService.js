const storage = require('../storage');

const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

const PROCESS_TYPES = {
  DEDUCTION_APPLY: 'deduction_apply',
  INSTALLMENT_APPLY: 'installment_apply',
  FEE_EXEMPTION: 'fee_exemption',
  ARREAR_FREEZE: 'arrear_freeze'
};

function createApprovalProcess(params) {
  const process = {
    type: params.type,
    studentId: params.studentId,
    relatedId: params.relatedId,
    relatedType: params.relatedType,
    title: params.title,
    description: params.description,
    applicant: params.applicant,
    approver: params.approver || null,
    status: APPROVAL_STATUS.PENDING,
    data: params.data || {},
    rejectReason: null
  };

  if (params.relatedType === 'arrear' && params.relatedId) {
    const arrear = storage.findById('arrearRecords', params.relatedId);
    if (arrear && params.type === PROCESS_TYPES.ARREAR_FREEZE) {
      storage.update('arrearRecords', params.relatedId, {
        approvalStatus: 'pending'
      });
    }
  }

  const savedProcess = storage.insert('approvalProcesses', process);
  
  if (params.relatedType === 'arrear' && params.relatedId) {
    storage.update('arrearRecords', params.relatedId, {
      approvalProcessId: savedProcess.id
    });
  }

  return savedProcess;
}

function approve(processId, approver, remark) {
  const process = storage.findById('approvalProcesses', processId);
  if (!process) throw new Error('审批流程不存在');
  if (process.status !== APPROVAL_STATUS.PENDING) {
    throw new Error('该流程已处理');
  }

  const updated = storage.update('approvalProcesses', processId, {
    status: APPROVAL_STATUS.APPROVED,
    approver: approver,
    approvedAt: new Date().toISOString(),
    approveRemark: remark
  });

  if (process.relatedType === 'arrear' && process.relatedId) {
    if (process.type === PROCESS_TYPES.ARREAR_FREEZE) {
      const arrear = storage.findById('arrearRecords', process.relatedId);
      if (arrear) {
        storage.update('arrearRecords', process.relatedId, {
          approvalStatus: 'approved',
          status: 'frozen',
          frozenAt: new Date().toISOString()
        });
      }
    }
  }

  return updated;
}

function reject(processId, approver, reason) {
  const process = storage.findById('approvalProcesses', processId);
  if (!process) throw new Error('审批流程不存在');
  if (process.status !== APPROVAL_STATUS.PENDING) {
    throw new Error('该流程已处理');
  }

  const updated = storage.update('approvalProcesses', processId, {
    status: APPROVAL_STATUS.REJECTED,
    approver: approver,
    rejectedAt: new Date().toISOString(),
    rejectReason: reason
  });

  if (process.relatedType === 'arrear' && process.relatedId) {
    const arrear = storage.findById('arrearRecords', process.relatedId);
    if (arrear) {
      storage.update('arrearRecords', process.relatedId, {
        approvalStatus: 'rejected'
      });
    }
  }

  return updated;
}

function getApprovalProcess(processId) {
  return storage.findById('approvalProcesses', processId);
}

function getPendingApprovals() {
  return storage.findMany('approvalProcesses', p => p.status === APPROVAL_STATUS.PENDING);
}

function getStudentApprovals(studentId, status) {
  const predicate = p => p.studentId === studentId;
  if (status) {
    return storage.findMany('approvalProcesses', p => predicate(p) && p.status === status);
  }
  return storage.findMany('approvalProcesses', predicate);
}

module.exports = {
  APPROVAL_STATUS,
  PROCESS_TYPES,
  createApprovalProcess,
  approve,
  reject,
  getApprovalProcess,
  getPendingApprovals,
  getStudentApprovals
};
