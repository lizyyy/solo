import { useState } from 'react'
import type { Appointment, AppointmentStatus, PrivacyLevel, Counselor, Schedule } from '../types'
import { statusLabels, statusColors, privacyLabels, privacyColors, formatDateTime, maskContent } from '../utils'

interface Props {
  appointments: Appointment[]
  counselors: Counselor[]
  schedules: Schedule[]
  onSelect: (id: string) => void
  onCreate: () => void
}

export default function AppointmentList({ appointments, counselors, schedules, onSelect, onCreate }: Props) {
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyLevel | 'all'>('all')
  const [counselorFilter, setCounselorFilter] = useState<string>('all')
  const [searchCode, setSearchCode] = useState('')

  const filtered = appointments.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (privacyFilter !== 'all' && a.privacyLevel !== privacyFilter) return false
    if (counselorFilter !== 'all' && a.counselorId !== counselorFilter) return false
    if (searchCode && !a.anonymousCode.toLowerCase().includes(searchCode.toLowerCase())) return false
    return true
  })

  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    no_show: appointments.filter(a => a.status === 'no_show').length,
    completed: appointments.filter(a => a.status === 'completed').length
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-muted">总预约</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-700">待确认</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-700">已确认</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-700">爽约</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{stats.no_show}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-700">已完成</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{stats.completed}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="搜索匿名编号..."
            value={searchCode}
            onChange={e => setSearchCode(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全部状态</option>
            {(Object.keys(statusLabels) as AppointmentStatus[]).map(s => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
          <select
            value={privacyFilter}
            onChange={e => setPrivacyFilter(e.target.value as PrivacyLevel | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全部隐私级别</option>
            {(Object.keys(privacyLabels) as PrivacyLevel[]).map(p => (
              <option key={p} value={p}>{privacyLabels[p]}</option>
            ))}
          </select>
          <select
            value={counselorFilter}
            onChange={e => setCounselorFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全部咨询师</option>
            {counselors.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            onClick={onCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + 新建预约
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">匿名编号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">隐私级别</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">咨询师</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">时间</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">备注</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">创建时间</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  暂无预约记录
                </td>
              </tr>
            ) : (
              filtered.map(a => {
                const counselor = counselors.find(c => c.id === a.counselorId)
                const schedule = schedules.find(s => s.id === a.scheduleId)
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{a.anonymousCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${privacyColors[a.privacyLevel]}`}>
                        {privacyLabels[a.privacyLevel]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{counselor?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {schedule ? `${schedule.date} ${schedule.startTime}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColors[a.status]}`}>
                        {statusLabels[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                      {maskContent(a.notes, a.privacyLevel)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{formatDateTime(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelect(a.id)}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
