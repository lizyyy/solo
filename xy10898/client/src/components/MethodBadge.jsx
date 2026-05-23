import React from 'react'

const methodColors = {
  GET: 'success',
  POST: 'primary',
  PUT: 'warning',
  DELETE: 'danger',
  PATCH: 'info'
}

const MethodBadge = ({ method }) => {
  return (
    <span className={`badge bg-${methodColors[method] || 'secondary'} method-badge`}>
      {method}
    </span>
  )
}

export default MethodBadge
