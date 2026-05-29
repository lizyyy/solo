import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import type { Reservation } from '../../shared/types'
import { INSTRUMENTS, TIME_SLOTS, NOISE_LEVELS } from '../../shared/types'

interface Props {
  reservation: Reservation | null
  onClose: () => void
}

export default function EditModal({ reservation, onClose }: Props) {
  const { rooms, createReservation, updateReservation } = useStore()
  const isEdit = !!reservation

  const [form, setForm] = useState({
    room: '',
    instrument: '',
    person: '',
    timeSlot: '',
    date: '',
    noiseLevel: 1,
    status: 'normal' as Reservation['status'],
  })

  useEffect(() => {
    if (reservation) {
      setForm({
        room: reservation.room,
        instrument: reservation.instrument,
        person: reservation.person,
        timeSlot: reservation.timeSlot,
        date: reservation.date,
        noiseLevel: reservation.noiseLevel,
        status: reservation.status,
      })
    }
  }, [reservation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit && reservation) {
      await updateReservation(reservation.id, form)
    } else {
      await createReservation(form)
    }
    onClose()
  }

  const inputCls = 'w-full bg-brand-800 border border-brand-600 text-brand-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-amber-400'
  const labelCls = 'block text-xs font-medium text-brand-300 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-brand-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-brand-600" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{isEdit ? '编辑预约' : '新增预约'}</h3>
          <button onClick={onClose} className="text-brand-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>琴房</label>
            <select className={inputCls} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} required>
              <option value="">请选择</option>
              {rooms.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>乐器类型</label>
            <select className={inputCls} value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })} required>
              <option value="">请选择</option>
              {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>预约人</label>
            <input className={inputCls} value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>日期</label>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className={labelCls}>时段</label>
              <select className={inputCls} value={form.timeSlot} onChange={(e) => setForm({ ...form, timeSlot: e.target.value })} required>
                <option value="">请选择</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>噪声等级</label>
            <select className={inputCls} value={form.noiseLevel} onChange={(e) => setForm({ ...form, noiseLevel: Number(e.target.value) })} required>
              {NOISE_LEVELS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          {isEdit && (
            <div>
              <label className={labelCls}>状态</label>
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Reservation['status'] })}>
                <option value="normal">正常</option>
                <option value="conflict">冲突</option>
                <option value="high_noise">高噪声</option>
                <option value="swapped">已换房</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-300 hover:text-white rounded transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-brand-900 font-medium rounded transition-colors">
              {isEdit ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
