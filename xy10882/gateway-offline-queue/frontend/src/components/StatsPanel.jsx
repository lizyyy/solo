import React from 'react'

function StatsPanel({ stats }) {
  if (!stats) return null

  const statItems = [
    { label: '总指令数', value: stats.commands?.total || 0, className: '' },
    { label: '排队中', value: stats.commands?.queued || 0, className: 'warning' },
    { label: '下发中', value: stats.commands?.dispatching || 0, className: '' },
    { label: '已执行', value: stats.commands?.executed || 0, className: 'success' },
    { label: '已确认', value: stats.commands?.confirmed || 0, className: 'success' },
    { label: '失败', value: stats.commands?.failed || 0, className: 'danger' },
    { label: '已过期', value: stats.commands?.expired || 0, className: 'danger' },
    { label: '在线设备', value: stats.devices?.online || 0, className: 'success' },
    { label: '离线设备', value: stats.devices?.offline || 0, className: 'danger' },
  ]

  return (
    <div className="stats-grid">
      {statItems.map((item, idx) => (
        <div key={idx} className={`stat-card ${item.className}`}>
          <h3>{item.label}</h3>
          <div className="value">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

export default StatsPanel
