import { useState } from 'react'
import type { Counselor, Schedule, Appointment } from '../types'
import { generateId } from '../utils'

interface Props {
  counselors: Counselor[]
  schedules: Schedule[]
  appointments: Appointment[]
  onAdd: (counselor: Counselor) => void
  onToggleActive: (id: string) => void
}

export default function CounselorList({ counselors, schedules, appointments, onAdd, onToggleActive }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState('')

  const getLoadData = (counselorId: string) => {
    const counselorSchedules = schedules.filter(s => s.counselorId === counselorId)
    const booked = counselorSchedules.filter(s => s.isBooked).length
    const total = counselorSchedules.length
    const loadRate = total > 0 ? Math.round((booked / total) * 100) : 0
    
    const counselorAppts = appointments.filter(a => a.counselorId === counselorId)
    const completed = counselorAppts.filter(a => a.status === 'completed').length
    const noShow = counselorAppts.filter(a => a.status === 'no_show').length

    return { total, booked, loadRate, completed, noShow }
  }

  const handleAdd = () => {
    if (!name || !specialization) return
    onAdd({
      id: generateId(),
      name,
      specialization,
      isActive: true
    })
    setName('')
    setSpecialization('')
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">咨询师管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
        >
          {showForm ? '取消' : '+ 添加咨询师'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">添加新咨询师</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">专长领域</label>
              <input
                type="text"
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
                placeholder="如：焦虑抑郁、青少年心理"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
            >
              确认添加
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {counselors.map(counselor => {
          const load = getLoadData(counselor.id)
          return (
            <div key={counselor.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{counselor.name}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      counselor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {counselor.isActive ? '在岗' : '休假/停诊'}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-1">{counselor.specialization}</p>
                </div>
                <button
                  onClick={() => onToggleActive(counselor.id)}
                  className="text-sm text-primary hover:underline"
                >
                  {counselor.isActive ? '停诊' : '恢复'}
                </button>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted">排班时段</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{load.total}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">已预约</p>
                  <p className="text-lg font-bold text-blue-900 mt-1">{load.booked}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">负载率</p>
                  <p className="text-lg font-bold text-green-900 mt-1">{load.loadRate}%</p>
                </div>
              </div>

              <div className="mt-4 flex gap-6 text-sm">
                <div>
                  <span className="text-muted">已完成: </span>
                  <span className="font-medium text-gray-900">{load.completed}</span>
                </div>
                <div>
                  <span className="text-muted">爽约: </span>
                  <span className="font-medium text-red-600">{load.noShow}</span>
                </div>
              </div>

              {load.loadRate > 70 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    ⚠️ 负载率较高（{load.loadRate}%），建议增加排班时段
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
