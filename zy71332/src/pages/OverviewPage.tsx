import { useState, useEffect } from 'react'
import { Plus, Download, FileDown } from 'lucide-react'
import { useStore } from '../store'
import FilterBar from '../components/FilterBar'
import ReservationTable from '../components/ReservationTable'
import EditModal from '../components/EditModal'
import SwapModal from '../components/SwapModal'
import type { Reservation } from '../../shared/types'

export default function OverviewPage() {
  const { fetchReservations, fetchRooms, fetchSwapLogs, exportReservations, exportSwapLogs, reservations } = useStore()
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [swapTarget, setSwapTarget] = useState<Reservation | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetchRooms()
    fetchReservations()
    fetchSwapLogs()
  }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">排班总览</h2>
        <div className="flex items-center gap-2">
          <button onClick={exportReservations} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-800 hover:bg-brand-700 text-brand-200 rounded transition-colors border border-brand-600">
            <Download size={12} />
            导出预约CSV
          </button>
          <button onClick={exportSwapLogs} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-800 hover:bg-brand-700 text-brand-200 rounded transition-colors border border-brand-600">
            <FileDown size={12} />
            导出换房记录CSV
          </button>
          <button
            onClick={() => { setEditTarget(null); setShowAdd(true) }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-brand-900 font-medium rounded transition-colors"
          >
            <Plus size={14} />
            新增预约
          </button>
        </div>
      </div>

      <div className="bg-brand-800 rounded-lg p-4 border border-brand-700">
        <FilterBar />
      </div>

      <div className="bg-brand-800 rounded-lg border border-brand-700">
        <div className="px-4 py-3 border-b border-brand-700 flex items-center justify-between">
          <span className="text-sm text-brand-300">共 {reservations.length} 条预约</span>
        </div>
        <ReservationTable
          onEdit={(r) => { setEditTarget(r); setShowAdd(true) }}
          onSwap={(r) => setSwapTarget(r)}
        />
      </div>

      {(showAdd || editTarget) && (
        <EditModal
          reservation={editTarget}
          onClose={() => { setEditTarget(null); setShowAdd(false) }}
        />
      )}

      {swapTarget && (
        <SwapModal
          reservation={swapTarget}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  )
}
