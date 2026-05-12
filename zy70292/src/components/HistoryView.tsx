import type { HistoryRecord, Appointment, Counselor, Schedule } from '../types'
import { formatDateTime, statusLabels } from '../utils'

interface Props {
  history: HistoryRecord[]
  appointments: Appointment[]
  counselors: Counselor[]
  schedules: Schedule[]
}

export default function HistoryView({ history, appointments, counselors, schedules }: Props) {
  const getAppointmentInfo = (appointmentId: string) => {
    const appt = appointments.find(a => a.id === appointmentId)
    if (!appt) return { code: '未知', counselor: '-', time: '-' }
    
    const counselor = counselors.find(c => c.id === appt.counselorId)
    const schedule = schedules.find(s => s.id === appt.scheduleId)
    
    return {
      code: appt.anonymousCode,
      counselor: counselor?.name || '-',
      time: schedule ? `${schedule.date} ${schedule.startTime}` : '-'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">历史追踪</h2>
        <p className="text-sm text-muted">
          记录所有预约的变更历史，共 {history.length} 条
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {history.length === 0 ? (
          <div className="py-12 text-center text-muted">
            暂无历史记录
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map(record => {
              const info = getAppointmentInfo(record.appointmentId)
              return (
                <div key={record.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-lg">📜</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{record.action}</span>
                          <span className="font-mono text-sm text-muted">
                            #{info.code}
                          </span>
                        </div>
                        <span className="text-xs text-muted">
                          {formatDateTime(record.timestamp)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        咨询师: {info.counselor} · 时间: {info.time}
                      </div>
                      {(record.before || record.after) && (
                        <div className="mt-2 flex gap-4">
                          {record.before && record.before.status && (
                            <div className="px-3 py-1.5 bg-red-50 rounded text-xs text-red-700">
                              变更前: {statusLabels[record.before.status as any] || JSON.stringify(record.before)}
                            </div>
                          )}
                          {record.after && record.after.status && (
                            <div className="px-3 py-1.5 bg-green-50 rounded text-xs text-green-700">
                              变更后: {statusLabels[record.after.status as any] || JSON.stringify(record.after)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
