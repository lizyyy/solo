import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  GitMerge,
  Wrench,
  FileSearch,
  Download,
  AlertOctagon,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import type { HotSpotRecord, SourceConflict } from '@/types'
import ErrorBanner from '@/components/ErrorBanner'

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-card)] rounded-xl p-5 border border-white/5',
        'hover:-translate-y-0.5 transition-transform duration-200'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{label}</span>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="text-3xl font-bold font-[JetBrains_Mono,monospace]" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-16 bg-white/10 rounded" />
        <div className="h-5 w-5 bg-white/10 rounded" />
      </div>
      <div className="h-9 w-20 bg-white/10 rounded" />
    </div>
  )
}

function tempToColor(temp: number, warning: number, critical: number): string {
  if (temp >= critical) return '#ef4444'
  if (temp >= warning) {
    const t = (temp - warning) / (critical - warning)
    const r = Math.round(245 + (239 - 245) * t)
    const g = Math.round(158 - 90 * t)
    const b = Math.round(11 + (68 - 11) * t)
    return `rgb(${r},${g},${b})`
  }
  const t = temp / warning
  const r = Math.round(59 + (245 - 59) * t)
  const g = Math.round(130 + (158 - 130) * t)
  const b = Math.round(246 - 235 * t)
  return `rgb(${r},${g},${b})`
}

interface HeatCell {
  record: HotSpotRecord | null
  color: string
  isMismatch: boolean
}

function HeatmapGrid({ records }: { records: HotSpotRecord[] }) {
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null)
  const scheme = useStore((s) => s.currentScheme)
  const warning = scheme?.warningThreshold ?? 80
  const critical = scheme?.criticalThreshold ?? 100
  const mainCoordSystem = scheme?.coordinateSystem ?? ''

  const grid = useMemo(() => {
    const g: HeatCell[][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ record: null as HotSpotRecord | null, color: '#0f172a', isMismatch: false }))
    )
    for (const r of records) {
      const x = Math.min(7, Math.max(0, Math.round(r.coordinateX)))
      const y = Math.min(7, Math.max(0, Math.round(r.coordinateY)))
      const existing = g[y][x]
      if (!existing.record || r.temperature > existing.record.temperature) {
        g[y][x] = {
          record: r,
          color: tempToColor(r.temperature, warning, critical),
          isMismatch: mainCoordSystem ? r.coordinateSystem !== mainCoordSystem : false,
        }
      }
    }
    return g
  }, [records, warning, critical, mainCoordSystem])

  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-1">
        {grid.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              onMouseEnter={() => setHovered({ x, y })}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'aspect-square rounded-sm cursor-default transition-all duration-150',
                cell.isMismatch && 'border border-dashed border-blue-500/60'
              )}
              style={{ backgroundColor: cell.color, opacity: cell.record ? 1 : 0.3 }}
            />
          ))
        )}
      </div>
      {hovered && (() => {
        const cell = grid[hovered.y][hovered.x]
        if (!cell.record) return null
        return (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-gray-900 border border-white/10 text-xs whitespace-nowrap z-10 pointer-events-none shadow-xl">
            <div className="font-bold text-white">{cell.record.name}</div>
            <div className="text-gray-300 mt-0.5">
              {cell.record.temperature}°C · ({cell.record.coordinateX}, {cell.record.coordinateY})
            </div>
            {cell.isMismatch && (
              <div className="text-blue-400 mt-0.5">坐标系: {cell.record.coordinateSystem}</div>
            )}
          </div>
        )
      })()}

      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span className="font-[JetBrains_Mono,monospace] text-blue-400">X →</span>
        <span className="font-[JetBrains_Mono,monospace] text-blue-400">Y ↓</span>
        <span className="mx-2">|</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
          <span>正常</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
          <span>Warning</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border border-dashed border-blue-500/60 bg-[#0f172a]" />
          <span>坐标系不一致</span>
        </div>
      </div>
    </div>
  )
}

function ConflictItem({ conflict }: { conflict: SourceConflict }) {
  const navigate = useNavigate()
  const severityColor: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  }
  const typeLabel: Record<string, string> = {
    coordinate_mismatch: '坐标不一致',
    value_mismatch: '数值不一致',
    coordinate_system_mismatch: '坐标系不一致',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg',
        'bg-[var(--bg-card)] border border-white/5',
        'hover:border-amber-500/30 cursor-pointer transition-colors'
      )}
      onClick={() => navigate('/trace')}
    >
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 whitespace-nowrap">
        {typeLabel[conflict.conflictType] ?? conflict.conflictType}
      </span>
      <span className="text-sm text-gray-300 flex-1 truncate">
        {conflict.sourceA?.sourceName ?? '来源A'} vs {conflict.sourceB?.sourceName ?? '来源B'}
      </span>
      <span
        className={cn('w-2 h-2 rounded-full shrink-0', severityColor[conflict.severity] ?? 'bg-gray-500')}
      />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { dashboardData, records, conflicts, loading, error, fetchDashboard, fetchRecords, fetchConflicts, fetchImportErrors, clearError } = useStore()

  useEffect(() => {
    fetchDashboard('demo-001')
    fetchRecords('demo-001')
    fetchConflicts('demo-001')
    fetchImportErrors('demo-001')
  }, [fetchDashboard, fetchRecords, fetchConflicts, fetchImportErrors])

  const unresolvedConflicts = conflicts.filter((c) => !c.resolvedAt)

  return (
    <div>
      <ErrorBanner />
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold font-[JetBrains_Mono,monospace] mb-6 text-amber-500">
          总览面板
        </h1>

        {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-300 hover:text-red-100 ml-4 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-6">
        {loading && !dashboardData ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              icon={Activity}
              label="总记录数"
              value={dashboardData?.totalRecords ?? 0}
              color="var(--amber)"
            />
            <StatCard
              icon={AlertTriangle}
              label="Critical 异常"
              value={dashboardData?.criticalCount ?? 0}
              color="var(--red)"
            />
            <StatCard
              icon={AlertCircle}
              label="Warning 异常"
              value={dashboardData?.warningCount ?? 0}
              color="#eab308"
            />
            <StatCard
              icon={GitMerge}
              label="未解决冲突"
              value={dashboardData?.unresolvedConflicts ?? 0}
              color="var(--blue)"
            />
            <StatCard
              icon={AlertOctagon}
              label="数据错误"
              value={dashboardData?.pendingErrors ?? 0}
              color="#ef4444"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5">
          <h2 className="text-base font-semibold font-[JetBrains_Mono,monospace] text-gray-200 mb-4">
            异常热力图
          </h2>
          {loading && records.length === 0 ? (
            <div className="grid grid-cols-8 gap-1 animate-pulse">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-sm bg-white/5" />
              ))}
            </div>
          ) : (
            <HeatmapGrid records={records} />
          )}
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5">
          <h2 className="text-base font-semibold font-[JetBrains_Mono,monospace] text-gray-200 mb-4">
            冲突摘要
          </h2>
          {loading && conflicts.length === 0 ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-white/5 rounded-lg" />
              ))}
            </div>
          ) : unresolvedConflicts.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">暂无未解决冲突</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {unresolvedConflicts.map((c) => (
                <ConflictItem key={c.id} conflict={c} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/workbench')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
            'bg-[var(--bg-card)] border border-white/10 text-gray-300',
            'hover:border-amber-500/40 hover:text-amber-400 transition-colors cursor-pointer'
          )}
        >
          <Wrench className="w-4 h-4" />
          进入工作台
        </button>
        <button
          onClick={() => navigate('/trace')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
            'bg-[var(--bg-card)] border border-white/10 text-gray-300',
            'hover:border-amber-500/40 hover:text-amber-400 transition-colors cursor-pointer'
          )}
        >
          <FileSearch className="w-4 h-4" />
          查看追溯
        </button>
        <button
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
            'bg-amber-500 text-gray-900 font-medium',
            'hover:bg-amber-400 transition-colors cursor-pointer'
          )}
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </div>
      </div>
    </div>
  )
}
