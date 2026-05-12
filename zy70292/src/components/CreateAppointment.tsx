import { useState } from 'react'
import type { Appointment, PrivacyLevel, Counselor, Schedule } from '../types'
import { generateId, generateAnonymousCode } from '../utils'

interface Props {
  counselors: Counselor[]
  schedules: Schedule[]
  onBack: () => void
  onCreate: (appointment: Appointment, selectedScheduleId: string) => void
}

export default function CreateAppointment({ counselors, schedules, onBack, onCreate }: Props) {
  const [counselorId, setCounselorId] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('standard')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const activeCounselors = counselors.filter(c => c.isActive)
  const availableSchedules = schedules.filter(
    s => !s.isBooked && s.counselorId === counselorId
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!counselorId) {
      setError('请选择咨询师')
      return
    }
    if (!scheduleId) {
      setError('请选择预约时间')
      return
    }

    const now = new Date().toISOString()
    const appointment: Appointment = {
      id: generateId(),
      anonymousCode: generateAnonymousCode(),
      privacyLevel,
      counselorId,
      scheduleId,
      status: 'pending',
      notes,
      createdAt: now,
      updatedAt: now
    }

    onCreate(appointment, scheduleId)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-gray-700">
          ← 返回列表
        </button>
        <h2 className="text-xl font-bold text-gray-900">新建匿名预约</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-900 font-medium">🔒 隐私保护</p>
            <p className="text-xs text-indigo-700 mt-1">
              预约创建后将生成唯一匿名编号。敏感信息根据隐私级别进行脱敏展示。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">隐私级别</label>
            <div className="grid grid-cols-3 gap-3">
              {(['standard', 'sensitive', 'anonymous'] as PrivacyLevel[]).map(level => (
                <label
                  key={level}
                  className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    privacyLevel === level
                      ? 'border-primary bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="privacyLevel"
                    value={level}
                    checked={privacyLevel === level}
                    onChange={() => setPrivacyLevel(level)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {level === 'standard' && '普通'}
                    {level === 'sensitive' && '敏感'}
                    {level === 'anonymous' && '完全匿名'}
                  </span>
                  <span className="text-xs text-muted mt-1">
                    {level === 'standard' && '完整展示信息'}
                    {level === 'sensitive' && '敏感信息部分脱敏'}
                    {level === 'anonymous' && '所有信息完全脱敏'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择咨询师</label>
            <select
              value={counselorId}
              onChange={e => {
                setCounselorId(e.target.value)
                setScheduleId('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">请选择咨询师</option>
              {activeCounselors.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.specialization}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择预约时间</label>
            {!counselorId ? (
              <p className="text-sm text-muted">请先选择咨询师</p>
            ) : availableSchedules.length === 0 ? (
              <p className="text-sm text-muted">该咨询师暂无可用时段，请先在排班管理中添加</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableSchedules.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      scheduleId === s.id
                        ? 'border-primary bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduleId"
                      value={s.id}
                      checked={scheduleId === s.id}
                      onChange={() => setScheduleId(s.id)}
                      className="sr-only"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.date}</p>
                      <p className="text-xs text-muted">{s.startTime} - {s.endTime}</p>
                    </div>
                    {scheduleId === s.id && (
                      <span className="text-primary text-sm">✓ 已选择</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">预约备注（可选）</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="简要描述咨询需求..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
            >
              创建预约
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
