import { useStore } from '../store'
import { Pencil, ArrowRightLeft, Trash2 } from 'lucide-react'
import type { Reservation } from '../../shared/types'

interface Props {
  onEdit: (r: Reservation) => void
  onSwap: (r: Reservation) => void
}

function NoiseBar({ level }: { level: number }) {
  const color = level <= 2 ? 'bg-green-500' : level <= 3 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-2 bg-brand-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${level * 20}%` }} />
      </div>
      <span className="mono text-xs text-brand-300">{level}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: Reservation['status'] }) {
  const map: Record<Reservation['status'], { label: string; cls: string }> = {
    conflict: { label: '冲突', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    high_noise: { label: '高噪声', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    swapped: { label: '已换房', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    normal: { label: '正常', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  }
  const s = map[status]
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
}

function rowBg(status: Reservation['status']) {
  switch (status) {
    case 'conflict': return 'bg-red-500/5'
    case 'high_noise': return 'bg-orange-500/5'
    case 'swapped': return 'bg-blue-500/5'
    default: return ''
  }
}

export default function ReservationTable({ onEdit, onSwap }: Props) {
  const { reservations, deleteReservation, loading } = useStore()

  const handleDelete = async (id: number) => {
    if (confirm('确定删除此预约？')) await deleteReservation(id)
  }

  if (loading && reservations.length === 0) {
    return <div className="text-brand-400 text-center py-10">加载中...</div>
  }

  if (reservations.length === 0) {
    return <div className="text-brand-400 text-center py-10">暂无预约数据</div>
  }

  const thCls = 'text-left text-xs font-medium text-brand-400 px-3 py-2 border-b border-brand-700'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={thCls}>ID</th>
            <th className={thCls}>琴房</th>
            <th className={thCls}>乐器类型</th>
            <th className={thCls}>预约人</th>
            <th className={thCls}>日期</th>
            <th className={thCls}>时段</th>
            <th className={thCls}>噪声等级</th>
            <th className={thCls}>状态</th>
            <th className={thCls}>操作</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.id} className={`border-b border-brand-700/50 hover:bg-brand-800/50 transition-colors ${rowBg(r.status)}`}>
              <td className="mono text-xs px-3 py-2 text-brand-300">{r.id}</td>
              <td className="px-3 py-2 text-brand-100">{r.room}</td>
              <td className="px-3 py-2 text-brand-200">{r.instrument}</td>
              <td className="px-3 py-2 text-brand-200">{r.person}</td>
              <td className="mono text-xs px-3 py-2 text-brand-300">{r.date}</td>
              <td className="mono text-xs px-3 py-2 text-brand-300">{r.timeSlot}</td>
              <td className="px-3 py-2"><NoiseBar level={r.noiseLevel} /></td>
              <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(r)} className="p-1 rounded hover:bg-brand-700 text-blue-400 transition-colors" title="编辑">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onSwap(r)} className="p-1 rounded hover:bg-brand-700 text-amber-400 transition-colors" title="换房">
                    <ArrowRightLeft size={14} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-brand-700 text-red-400 transition-colors" title="删除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
