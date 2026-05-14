import React from 'react';

function StatusBadge({ status }) {
  const config = getStatusConfig(status);

  return (
    <span style={{ ...styles.badge, ...config.style }}>
      {config.label}
    </span>
  );
}

const getStatusConfig = (status) => {
  const configs = {
    draft: { label: '草稿', style: { backgroundColor: '#95a5a6', color: 'white' } },
    pending_review: { label: '待审核', style: { backgroundColor: '#f39c12', color: 'white' } },
    blocked: { label: '已拦截', style: { backgroundColor: '#e74c3c', color: 'white' } },
    approved: { label: '已批准', style: { backgroundColor: '#27ae60', color: 'white' } },
    published: { label: '已发布', style: { backgroundColor: '#2ecc71', color: 'white' } },
    rollbacked: { label: '已回滚', style: { backgroundColor: '#8e44ad', color: 'white' } },
  };
  return configs[status] || { label: status, style: {} };
};

const styles = {
  badge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
};

export default StatusBadge;
