export const OFFER_STATUS = {
  draft: { label: '草稿', color: 'default' },
  pending_approval: { label: '审批中', color: 'processing' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
  withdrawn: { label: '已撤回', color: 'warning' },
  rejected_by_candidate: { label: '候选人拒绝', color: 'error' }
};

export const CANDIDATE_STATUS = {
  interviewing: { label: '面试中', color: 'processing' },
  offer_sent: { label: '已发 Offer', color: 'blue' },
  offer_accepted: { label: '已接受', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
  hired: { label: '已入职', color: 'success' }
};

export const USER_ROLES = {
  hr: 'HR',
  hr_admin: 'HR管理员',
  manager: '部门经理',
  director: '总监'
};

export const getOfferStatusTag = (status) => {
  return OFFER_STATUS[status] || { label: status, color: 'default' };
};

export const getCandidateStatusTag = (status) => {
  return CANDIDATE_STATUS[status] || { label: status, color: 'default' };
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-';
  return `¥${Number(amount).toLocaleString()}`;
};

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
