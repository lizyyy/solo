const ApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
};

const ApprovalAction = {
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REJECT: 'reject',
  CANCEL: 'cancel',
  EXPIRE: 'expire',
  RELEASE: 'release',
};

const QuotaActionType = {
  OCCUPY: 'occupy',
  RELEASE: 'release',
  DEDUCT: 'deduct',
  RETURN: 'return',
};

const StatusFlow = {
  [ApprovalStatus.PENDING]: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELED, ApprovalStatus.EXPIRED],
  [ApprovalStatus.APPROVED]: [],
  [ApprovalStatus.REJECTED]: [],
  [ApprovalStatus.CANCELED]: [],
  [ApprovalStatus.EXPIRED]: [],
};

const ReleaseStatuses = [ApprovalStatus.REJECTED, ApprovalStatus.CANCELED, ApprovalStatus.EXPIRED];

module.exports = {
  ApprovalStatus,
  ApprovalAction,
  QuotaActionType,
  StatusFlow,
  ReleaseStatuses,
};
