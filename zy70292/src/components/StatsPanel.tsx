import { useState } from 'react'
import type { Appointment, Counselor, Schedule, PrivacyLevel, AppointmentStatus } from '../types'
import { statusLabels, privacyLabels, exportToCSV } from '../utils'

interface Props {
  appointments: Appointment[]
  counselors: Counselor[]
  schedules: Schedule[]
}

export default function StatsPanel({ appointments, counselors, schedules }: Props) {
  const [exportSuccess, setExportSuccess] = useState(false)

  const total = appointments.length
  const byStatus = (Object.keys(statusLabels) as AppointmentStatus[]).reduce((acc, s) => {
    acc[s] = appointments.filter(a => a.status === s).length
    return acc
  }, {} as Record<AppointmentStatus, number>)

  const byPrivacy = (Object.keys(privacyLabels) as PrivacyLevel[]).reduce((acc, p) => {
    acc[p] = appointments.filter(a => a.privacyLevel === p).length
    return acc
  }, {} as Record<PrivacyLevel, number>)

  const noShowRate = total > 0 
    ? Math.round((byStatus.no_show / (byStatus.completed + byStatus.no_show)) * 100)
    : 0

  const totalSlots = schedules.length
  const bookedSlots = schedules.filter(s => s.isBooked).length
  const utilizationRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0

  const counselorStats = counselors.map(c => {
    const cSchedules = schedules.filter(s => s.counselorId === c.id)
    const cBooked = cSchedules.filter(s => s.isBooked).length
    const cAppts = appointments.filter(a => a.counselorId === c.id)
    const cNoShow = cAppts.filter(a => a.status === 'no_show').length
    const cCompleted = cAppts.filter(a => a.status === 'completed').length
    return {
      counselor: c,
      totalSlots: cSchedules.length,
      bookedSlots: cBooked,
      loadRate: cSchedules.length > 0 ? Math.round((cBooked / cSchedules.length) * 100) : 0,
      completed: cCompleted,
      noShow: cNoShow,
      noShowRate: (cCompleted + cNoShow) > 0 
        ? Math.round((cNoShow / (cCompleted + cNoShow)) * 100) 
        : 0
    }
  })

  const handleExport = () => {
    exportToCSV(appointments, counselors, schedules)
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">统计面板</h2>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          {exportSuccess ? '✓ 已导出' : '导出 CSV'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">总预约数</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">📋</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">整体负载率</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{utilizationRate}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">📊</div>
          </div>
          <p className="text-xs text-muted mt-2">{bookedSlots}/{totalSlots} 时段已预约</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">爽约率</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{noShowRate}%</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl">⚠️</div>
          </div>
          <p className="text-xs text-muted mt-2">
            已完成 {byStatus.completed} · 爽约 {byStatus.no_show}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">活跃咨询师</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {counselors.filter(c => c.isActive).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">👨‍⚕️</div>
          </div>
          <p className="text-xs text-muted mt-2">共 {counselors.length} 位咨询师</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">按状态分布</h3>
          <div className="space-y-3">
            {(Object.keys(statusLabels) as AppointmentStatus[]).map(status => {
              const count = byStatus[status]
              const percent = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{statusLabels[status]}</span>
                    <span className="text-muted">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">按隐私级别分布</h3>
          <div className="space-y-3">
            {(Object.keys(privacyLabels) as PrivacyLevel[]).map(level => {
              const count = byPrivacy[level]
              const percent = total > 0 ? Math.round((count / total) * 100) : 0
              const color = level === 'anonymous' ? 'bg-indigo-500' : 
                           level === 'sensitive' ? 'bg-orange-500' : 'bg-slate-500'
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{privacyLabels[level]}</span>
                    <span className="text-muted">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">咨询师负载对比</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 text-xs font-medium text-muted uppercase">咨询师</th>
              <th className="text-left py-3 text-xs font-medium text-muted uppercase">专长</th>
              <th className="text-center py-3 text-xs font-medium text-muted uppercase">排班数</th>
              <th className="text-center py-3 text-xs font-medium text-muted uppercase">已预约</th>
              <th className="text-center py-3 text-xs font-medium text-muted uppercase">负载率</th>
              <th className="text-center py-3 text-xs font-medium text-muted uppercase">已完成</th>
              <th className="text-center py-3 text-xs font-medium text-muted uppercase">爽约</th>
              <th className="text-center py-3 text-xs font-medium text-muted uppercase">爽约率</th>
            </tr>
          </thead>
          <tbody>
            {counselorStats.map(({ counselor, totalSlots, bookedSlots, loadRate, completed, noShow, noShowRate }) => (
              <tr key={counselor.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">
                  <span className="font-medium text-gray-900">{counselor.name}</span>
                  {!counselor.isActive && (
                    <span className="ml-2 text-xs text-muted">(停诊)</span>
                  )}
                </td>
                <td className="py-3 text-sm text-muted">{counselor.specialization}</td>
                <td className="py-3 text-center text-sm">{totalSlots}</td>
                <td className="py-3 text-center text-sm">{bookedSlots}</td>
                <td className="py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    loadRate > 70 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {loadRate}%
                  </span>
                </td>
                <td className="py-3 text-center text-sm text-green-600">{completed}</td>
                <td className="py-3 text-center text-sm text-red-600">{noShow}</td>
                <td className="py-3 text-center">
                  <span className={`text-sm font-medium ${
                    noShowRate > 20 ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {noShowRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
