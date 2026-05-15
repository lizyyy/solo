import React from 'react'

function StatsCard({ title, value, color }) {
  return (
    <div className="stats-card">
      <h3>{title}</h3>
      <div className="stats-value" style={{ color }}>{value || 0}</div>
    </div>
  )
}

export default StatsCard
