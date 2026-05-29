import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import type { Reservation } from '../../shared/types'

interface Props {
  reservation: Reservation | null
  onClose: () => void
}

export default function SwapModal({ reservation, onClose }: Props) {
  const { rooms, swapRoom } = useStore()
  const [newRoom, setNewRoom] = useState('')
  const [reason, setReason] = useState('')

  if (!reservation) return null

  const availableRooms = rooms.filter((r) => r.name !== reservation.room)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoom) return
    await swapRoom(reservation.id, newRoom, reason)
    onClose()
  }

  const inputCls = 'w-full bg-brand-800 border border-brand-600 text-brand-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-amber-400'
  const labelCls = 'block text-xs font-medium text-brand-300 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-brand-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-brand-600" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">换房操作</h3>
          <button onClick={onClose} className="text-brand-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="mb-4 p-3 bg-brand-700/50 rounded-lg">
          <p className="text-xs text-brand-400">当前预约信息</p>
          <p className="text-sm text-brand-100 mt-1">琴房: <span className="font-medium">{reservation.room}</span></p>
          <p className="text-sm text-brand-100">预约人: {reservation.person} | 日期: {reservation.date} | 时段: {reservation.timeSlot}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>目标琴房</label>
            <select className={inputCls} value={newRoom} onChange={(e) => setNewRoom(e.target.value)} required>
              <option value="">请选择新琴房</option>
              {availableRooms.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>换房原因</label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入换房原因..."
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-300 hover:text-white rounded transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-brand-900 font-medium rounded transition-colors">确认换房</button>
          </div>
        </form>
      </div>
    </div>
  )
}
