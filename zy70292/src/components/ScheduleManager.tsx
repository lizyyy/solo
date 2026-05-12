import { useState } from 'react'
import type { Counselor, Schedule } from '../types'
import { generateId } from '../utils'

interface Props {
  counselors: Counselor[]
  schedules: Schedule[]
  onAdd: (schedule: Schedule) => void
  onDelete: (id: string) => void
}

const TIME_SLOTS = [
  '09:00-10:00',
  '10:30-11:30',
  '14:00-15:00',
  '15:30-16:30',
  '17:00-18:00'
]

export default function ScheduleManager({ counselors, schedules, onAdd, onDelete }: Props) {
  const [selectedCounselor, setSelectedCounselor] = useState(counselors[0]?.id || '')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])

  const activeCounselors = counselors.filter(c => c.isActive)
  const currentCounselor = counselors.find(c => c.id === selectedCounselor)

  const counselorSchedules = schedules.filter(s => s.counselorId === selectedCounselor)
  
  const dates = [...new Set(counselorSchedules.map(s => s.date))].sort()

  const getToday = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const handleAddSchedule = () => {
    if (!selectedDate || selectedSlots.length === 0) return
    
    const dateStr = selectedDate.split('-').join('/').replace(/\//g, '/')
    const formatDate = (iso: string) => {
      const [y, m, d] = iso.split('-')
      return `${y}/${m}/${d}`
    }

    selectedSlots.forEach(slot => {
      const [start, end] = slot.split('-')
      onAdd({
        id: generateId(),
        counselorId: selectedCounselor,
        date: formatDate(selectedDate),
        startTime: start,
        endTime: end,
        isBooked: false
      })
    })

    setSelectedSlots([])
  }

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev => 
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">排班管理</h2>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">添加排班</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择咨询师</label>
                <select
                  value={selectedCounselor}
                  onChange={e => setSelectedCounselor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {activeCounselors.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择日期</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={getToday()}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择时段</label>
                <div className="space-y-2">
                  {TIME_SLOTS.map(slot => (
                    <label
                      key={slot}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer ${
                        selectedSlots.includes(slot)
                          ? 'border-primary bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSlots.includes(slot)}
                        onChange={() => toggleSlot(slot)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-gray-900">{slot}</span>
                      {selectedSlots.includes(slot) && (
                        <span className="text-primary">✓</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddSchedule}
                disabled={!selectedDate || selectedSlots.length === 0}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加排班
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentCounselor?.name || '咨询师'} 排班表
              </h3>
            </div>

            {dates.length === 0 ? (
              <div className="py-12 text-center text-muted">
                暂无排班，请先添加
              </div>
            ) : (
              <div className="space-y-6">
                {dates.map(date => {
                  const daySchedules = counselorSchedules.filter(s => s.date === date)
                  const booked = daySchedules.filter(s => s.isBooked).length
                  return (
                    <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-gray-900">{date}</span>
                          <span className="text-sm text-muted">
                            {daySchedules.length} 个时段 · 已预约 {booked}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2 p-4">
                        {daySchedules.map(s => (
                          <div
                            key={s.id}
                            className={`p-3 rounded-lg border text-center relative ${
                              s.isBooked
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <p className={`text-sm font-medium ${
                              s.isBooked ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {s.startTime}
                            </p>
                            <p className="text-xs text-muted mt-0.5">{s.endTime}</p>
                            <p className={`text-xs mt-1 ${
                              s.isBooked ? 'text-blue-700' : 'text-green-700'
                            }`}>
                              {s.isBooked ? '已预约' : '空闲'}
                            </p>
                            {!s.isBooked && (
                              <button
                                onClick={() => onDelete(s.id)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs hover:bg-red-200"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
