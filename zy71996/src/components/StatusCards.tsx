import { useMemo } from 'react'
import { useInspectionStore } from '@/store/inspectionStore'
import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react'

export default function StatusCards() {
  const records = useInspectionStore((s) => s.records)

  const summary = useMemo(() => {
    const confirmed = records.filter((r) => r.status === 'confirmed')
    const pending = records.filter((r) => r.status === 'pending_supplement')
    const manual = records.filter((r) => r.status === 'manually_modified')
    return {
      confirmed: confirmed.length,
      pendingSupplement: pending.length,
      manuallyModified: manual.length,
    }
  }, [records])

  const cards = [
    {
      label: '已确认',
      value: summary.confirmed,
      icon: ShieldCheck,
      color: 'bg-emerald-600',
      desc: '自动确认或人工确认',
    },
    {
      label: '待补材料',
      value: summary.pendingSupplement,
      icon: Clock,
      color: 'bg-amber-500',
      desc: '配置早到 / 日志晚补',
    },
    {
      label: '人工改过',
      value: summary.manuallyModified,
      icon: AlertTriangle,
      color: 'bg-rose-600',
      desc: '变更单手工改动',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(({ label, value, icon: Icon, color, desc }) => (
        <div
          key={label}
          className={`${color} rounded-xl px-5 py-4 text-white shadow-sm`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-80">{desc}</p>
              <p className="text-3xl font-bold mt-1">{value}</p>
            </div>
            <Icon size={36} className="opacity-30" />
          </div>
          <p className="text-sm font-semibold mt-2">{label}</p>
        </div>
      ))}
    </div>
  )
}
