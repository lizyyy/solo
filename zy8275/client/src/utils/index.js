export const getStatusBadgeClass = (status) => {
  const statusMap = {
    'DRAFT': 'status-draft',
    'SUBMITTED': 'status-submitted',
    'ENGINEERING_REVIEW': 'status-review',
    'ENGINEERING_APPROVED': 'status-approved',
    'ENGINEERING_REJECTED': 'status-rejected',
    'SECURITY_REVIEW': 'status-review',
    'SECURITY_APPROVED': 'status-approved',
    'SECURITY_REJECTED': 'status-rejected',
    'READY': 'status-submitted',
    'IN_PROGRESS': 'status-in-progress',
    'PAUSED': 'status-paused',
    'COMPLETED': 'status-completed',
    'ARCHIVED': 'status-archived',
    'CANCELLED': 'status-cancelled',
  };
  return statusMap[status] || 'status-draft';
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getActionButtonClass = (action) => {
  const actionMap = {
    'SUBMIT': 'btn-primary',
    'ENGINEERING_REVIEW_START': 'btn-secondary',
    'ENGINEERING_APPROVE': 'btn-success',
    'ENGINEERING_REJECT': 'btn-danger',
    'SECURITY_REVIEW_START': 'btn-secondary',
    'SECURITY_APPROVE': 'btn-success',
    'SECURITY_REJECT': 'btn-danger',
    'CHECK_IN': 'btn-primary',
    'PAUSE': 'btn-warning',
    'RESUME': 'btn-success',
    'COMPLETE': 'btn-success',
    'ARCHIVE': 'btn-secondary',
    'CANCEL': 'btn-danger',
  };
  return actionMap[action] || 'btn-secondary';
};
