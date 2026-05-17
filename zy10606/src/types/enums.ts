export enum ApprovalStatus {
  PENDING = 'pending',
  SIGNING = 'signing',
  TIMEOUT = 'timeout',
  COMPLETED = 'completed',
  WITHDRAWN = 'withdrawn'
}

export enum SignStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  TIMEOUT = 'timeout',
  TRANSFERRED = 'transferred'
}

export enum OperationType {
  IMPORT = 'import',
  CREATE = 'create',
  SIGN = 'sign',
  REMARK = 'remark',
  TIMEOUT = 'timeout',
  REMIND = 'remind',
  WITHDRAW = 'withdraw',
  RESUBMIT = 'resubmit',
  TRANSFER = 'transfer',
  COMPLETE = 'complete'
}

export const ApprovalStatusLabel: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: '审批中',
  [ApprovalStatus.SIGNING]: '加签中',
  [ApprovalStatus.TIMEOUT]: '已超时',
  [ApprovalStatus.COMPLETED]: '已办结',
  [ApprovalStatus.WITHDRAWN]: '已撤回'
};

export const SignStatusLabel: Record<SignStatus, string> = {
  [SignStatus.PENDING]: '待处理',
  [SignStatus.APPROVED]: '已同意',
  [SignStatus.REJECTED]: '已拒绝',
  [SignStatus.TIMEOUT]: '已超时',
  [SignStatus.TRANSFERRED]: '已转交'
};

export const OperationTypeLabel: Record<OperationType, string> = {
  [OperationType.IMPORT]: '导入记录',
  [OperationType.CREATE]: '创建审批',
  [OperationType.SIGN]: '加签审批',
  [OperationType.REMARK]: '人工备注',
  [OperationType.TIMEOUT]: '超时处理',
  [OperationType.REMIND]: '发送催办',
  [OperationType.WITHDRAW]: '撤回审批',
  [OperationType.RESUBMIT]: '重新提交',
  [OperationType.TRANSFER]: '转交处理',
  [OperationType.COMPLETE]: '审批办结'
};
