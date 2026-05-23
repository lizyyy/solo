import React from 'react'

const statusColors = {
  pending: 'warning',
  reviewing: 'primary',
  approved: 'success',
  rejected: 'danger',
  archived: 'secondary'
}

const statusLabels = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived'
}

const StatusBadge = ({ status }) => {
  return (
    <span className={`badge bg-${statusColors[status] || 'secondary'} status-badge`}>
      {statusLabels[status] || status}
    </span>
  )
}

export default StatusBadge
