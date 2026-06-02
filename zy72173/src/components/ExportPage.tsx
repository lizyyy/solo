import { useStore } from '@/store/useStore'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS } from '@/types'
import type { PointStatus } from '@/types'
import { Download, CheckCircle2, HelpCircle, Eye, FileSpreadsheet, BarChart3 } from 'lucide-react'
import { crossPeriodStats } from '@/data/mockData'

const statusConfig: Record<PointStatus, { icon: typeof CheckCircle2; label: string; color: string; bgLight: string }> = {
  completed: { icon: CheckCircle2, label: '已处理', color: STATUS_COLORS.completed, bgLight: 'rgba(16, 185, 129, 0.08)' },
  pending_verify: { icon: HelpCircle, label: '待核实', color: STATUS_COLORS.pending_verify, bgLight: 'rgba(249, 115, 22, 0.08)' },
  need_onsite: { icon: Eye, label: '需现场复看', color: STATUS_COLORS.need_onsite, bgLight: 'rgba(239, 68, 68, 0.08)' },
}

function exportCSV(points: { id: string; intersectionName: string; intersectionCode: string; status: PointStatus; source: string; category: string; description: string; inspector: string | null; inspectDate: string }[], filename: string) {
  const header = '编号,路口名称,路口编号,状态,来源,类别,描述,巡检人,巡检日期'
  const rows = points.map((p) =>
    `${p.id},${p.intersectionName},${p.intersectionCode},${STATUS_LABELS[p.status]},${SOURCE_LABELS[p.source as keyof typeof SOURCE_LABELS]},${p.category},"${p.description}",${p.inspector ?? ''},${p.inspectDate}`
  )
  const BOM = '\uFEFF'
  const csv = BOM + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const { points } = useStore()

  const grouped = {
    completed: points.filter((p) => p.status === 'completed'),
    pending_verify: points.filter((p) => p.status === 'pending_verify'),
    need_onsite: points.filter((p) => p.status === 'need_onsite'),
  }

  const handleExportAll = () => {
    exportCSV(points, '地下空间导视巡检_全部.csv')
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">导出中心</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>按状态分类导出，月底复盘直接可用</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleExportAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--color-accent)', color: '#0F172A' }}
        >
          <Download size={16} />
          导出全部记录
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {(Object.keys(statusConfig) as PointStatus[]).map((status) => {
          const config = statusConfig[status]
          const Icon = config.icon
          const list = grouped[status]

          return (
            <div
              key={status}
              className="rounded-xl border p-5 transition-all duration-200 hover:shadow-lg"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: config.bgLight }}>
                    <Icon size={18} style={{ color: config.color }} />
                  </div>
                  <span className="text-sm font-semibold">{config.label}</span>
                </div>
                <span className="text-2xl font-bold font-mono-data" style={{ color: config.color }}>
                  {list.length}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {list.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-surface-alt)' }}>
                    <span className="truncate flex-1">{p.intersectionName}</span>
                    <span className="font-mono-data ml-2" style={{ color: 'var(--color-text-muted)' }}>{p.intersectionCode}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => exportCSV(list, `地下空间导视巡检_${config.label}.csv`)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors border"
                style={{ borderColor: config.color, color: config.color }}
              >
                <FileSpreadsheet size={14} />
                导出{config.label}记录
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-sm font-semibold">跨时段统计</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--color-text-muted)' }}>
                <th className="text-left py-2 px-3 font-medium">月份</th>
                <th className="text-center py-2 px-3 font-medium">总点位</th>
                <th className="text-center py-2 px-3 font-medium">已处理</th>
                <th className="text-center py-2 px-3 font-medium">待核实</th>
                <th className="text-center py-2 px-3 font-medium">需现场复看</th>
              </tr>
            </thead>
            <tbody>
              {crossPeriodStats.map((stat) => (
                <tr key={stat.month} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-2.5 px-3 font-mono-data font-medium">{stat.month}</td>
                  <td className="py-2.5 px-3 text-center font-mono-data">{stat.total}</td>
                  <td className="py-2.5 px-3 text-center font-mono-data" style={{ color: 'var(--color-completed)' }}>{stat.completed}</td>
                  <td className="py-2.5 px-3 text-center font-mono-data" style={{ color: 'var(--color-pending)' }}>{stat.pendingVerify}</td>
                  <td className="py-2.5 px-3 text-center font-mono-data" style={{ color: 'var(--color-need-onsite)' }}>{stat.needOnsite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}>
          <p>3月仅1条旧口径补录记录（P003），未及时录入系统。5月新增6条巡检记录，其中3条已处理，2条待核实，2条需现场复看。建议下月重点关注P005重复投诉和P006边界记录。</p>
        </div>
      </div>
    </div>
  )
}
