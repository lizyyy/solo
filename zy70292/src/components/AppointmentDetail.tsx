import { useState } from 'react'
import type { Appointment, AppointmentStatus, Counselor, Schedule, HistoryRecord } from '../types'
import { statusLabels, statusColors, privacyLabels, privacyColors, formatDateTime } from '../utils'

interface Props {
  appointment: Appointment
  counselors: Counselor[]
  schedules: Schedule[]
  history: HistoryRecord[]
  onBack: () => void
  onStatusChange: (id: string, newStatus: AppointmentStatus) => void
  onReschedule: (id: string, newScheduleId: string) => void
  onCancel: (id: string) => void
  onEdit: (id: string, updates: Partial<Appointment>) => void
}

const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'rescheduled', 'cancelled'],
  completed: [],
  no_show: [],
  rescheduled: ['confirmed', 'cancelled'],
  cancelled: []
}

const actionLabels: Record<AppointmentStatus, string> = {
  pending: '确认预约',
  confirmed: '确认完成',
  completed: '',
  no_show: '',
  rescheduled: '重新确认',
  cancelled: ''
}

export default function AppointmentDetail({
  appointment,
  counselors,
  schedules,
  history,
  onBack,
  onStatusChange,
  onReschedule,
  onCancel,
  onEdit
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [editForm, setEditForm] = useState({
    notes: appointment.notes,
    privacyLevel: appointment.privacyLevel
  })

  const counselor = counselors.find(c => c.id === appointment.counselorId)
  const schedule = schedules.find(s => s.id === appointment.scheduleId)
  const apptHistory = history.filter(h => h.appointmentId === appointment.id)

  const availableSchedules = schedules.filter(
    s => !s.isBooked && s.counselorId === appointment.counselorId
  )

  const handleSaveEdit = () => {
    onEdit(appointment.id, {
      notes: editForm.notes,
      privacyLevel: editForm.privacyLevel
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted hover:text-gray-700"
        >
          ← 返回列表
        </button>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            {isEditing ? '取消编辑' : '编辑'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  匿名编号: <span className="font-mono">{appointment.anonymousCode}</span>
                </h2>
                <p className="text-sm text-muted mt-1">
                  创建于 {formatDateTime(appointment.createdAt)}
                </p>
              </div>
              <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${statusColors[appointment.status]}`}>
                {statusLabels[appointment.status]}
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">隐私级别</label>
                  <select
                    value={editForm.privacyLevel}
                    onChange={e => setEditForm({ ...editForm, privacyLevel: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="standard">普通</option>
                    <option value="sensitive">敏感</option>
                    <option value="anonymous">匿名</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                  >
                    保存修改
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">隐私级别</p>
                  <span className={`inline-flex mt-2 px-3 py-1.5 rounded-lg text-sm font-medium ${privacyColors[appointment.privacyLevel]}`}>
                    {privacyLabels[appointment.privacyLevel]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">咨询师</p>
                  <p className="mt-2 text-gray-900 font-medium">{counselor?.name || '-'}</p>
                  <p className="text-sm text-muted">{counselor?.specialization}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">预约日期</p>
                  <p className="mt-2 text-gray-900 font-medium">{schedule?.date || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">预约时间</p>
                  <p className="mt-2 text-gray-900 font-medium">
                    {schedule ? `${schedule.startTime} - ${schedule.endTime}` : '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">备注</p>
                  <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                    {appointment.notes || '（无）'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">状态流转</h3>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions[appointment.status].map(target => {
                if (target === 'cancelled') return null
                if (target === 'no_show') {
                  return (
                    <button
                      key={target}
                      onClick={() => onStatusChange(appointment.id, target)}
                      className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100"
                    >
                      标记爽约
                    </button>
                  )
                }
                return (
                  <button
                    key={target}
                    onClick={() => onStatusChange(appointment.id, target)}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
                  >
                    {actionLabels[target]}
                  </button>
                )
              })}
              {appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointment.status !== 'no_show' && (
                <>
                  {appointment.status === 'confirmed' && (
                    <button
                      onClick={() => setShowReschedule(!showReschedule)}
                      className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100"
                    >
                      {showReschedule ? '取消改约' : '申请改约'}
                    </button>
                  )}
                  <button
                    onClick={() => onCancel(appointment.id)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    取消预约
                  </button>
                </>
              )}
            </div>

            {showReschedule && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-900 mb-3">选择新的时间段</p>
                {availableSchedules.length === 0 ? (
                  <p className="text-sm text-purple-700">该咨询师当前无可用时段</p>
                ) : (
                  <div className="space-y-2">
                    {availableSchedules.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onReschedule(appointment.id, s.id)
                          setShowReschedule(false)
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-100"
                      >
                        <span className="text-sm font-medium text-gray-900">{s.date}</span>
                        <span className="text-sm text-muted">{s.startTime} - {s.endTime}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">变更历史</h3>
            {apptHistory.length === 0 ? (
              <p className="text-sm text-muted">暂无历史记录</p>
            ) : (
              <div className="space-y-4">
                {apptHistory.map(h => (
                  <div key={h.id} className="relative pl-6 pb-4 border-l-2 border-gray-200 last:pb-0">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-primary rounded-full" />
                    <p className="text-sm font-medium text-gray-900">{h.action}</p>
                    <p className="text-xs text-muted mt-1">{formatDateTime(h.timestamp)}</p>
                    {h.before && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                        变更前: {h.before.status ? statusLabels[h.before.status as AppointmentStatus] : JSON.stringify(h.before)}
                      </div>
                    )}
                    {h.after && (
                      <div className="mt-1 p-2 bg-green-50 rounded text-xs text-green-700">
                        变更后: {h.after.status ? statusLabels[h.after.status as AppointmentStatus] : JSON.stringify(h.after)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
