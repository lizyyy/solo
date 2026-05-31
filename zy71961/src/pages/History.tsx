import { useEffect, useState } from 'react'
import {
  History,
  Filter,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import type { EntityType } from '@/types'

const entityTypeLabels: Record<EntityType, string> = {
  conclusion: '结论',
  evaluation: '评估',
  feedback: '反馈',
}

const entityTypeColors: Record<EntityType, string> = {
  conclusion: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  evaluation: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  feedback: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
}

export default function HistoryPage() {
  const {
    changes,
    reports,
    consistencyResult,
    loading,
    loadChanges,
    loadReports,
    loadModels,
    checkConsistency,
  } = useAppStore()

  const [entityType, setEntityType] = useState<string>('')
  const [operator, setOperator] = useState('')
  const [reportId, setReportId] = useState<string>('')
  const [consistencyReportId, setConsistencyReportId] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadModels()
    loadReports()
    loadChanges()
  }, [loadModels, loadReports, loadChanges])

  useEffect(() => {
    loadChanges({
      reportId: reportId || undefined,
      entityType: entityType || undefined,
      operator: operator || undefined,
    })
  }, [entityType, operator, reportId, loadChanges])

  const handleCheckConsistency = () => {
    if (!consistencyReportId) return
    checkConsistency(consistencyReportId)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hour}:${min}`
  }

  const filteredReports = reports

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6" style={{ color: 'var(--accent-amber)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            变更历史
          </h1>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            showFilters
              ? 'bg-[var(--accent-amber)] text-[var(--bg-primary)]'
              : 'border border-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]',
          )}
          style={showFilters ? undefined : { color: 'var(--text-secondary)' }}
        >
          <Filter className="h-4 w-4" />
          筛选
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')}
          />
        </button>
      </div>

      {showFilters && (
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--bg-tertiary)',
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                实体类型
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">全部</option>
                <option value="conclusion">结论</option>
                <option value="evaluation">评估</option>
                <option value="feedback">反馈</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                操作人
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="输入操作人"
                className="rounded-md border px-3 py-1.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                关联报告
              </label>
              <select
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">全部报告</option>
                {filteredReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.date} - {r.model_name || r.model_id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div
        className="rounded-lg border p-4"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--bg-tertiary)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            一致性检查
          </h2>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              选择报告
            </label>
            <select
              value={consistencyReportId}
              onChange={(e) => setConsistencyReportId(e.target.value)}
              className="rounded-md border px-3 py-1.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">请选择报告</option>
              {filteredReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date} - {r.model_name || r.model_id}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCheckConsistency}
            disabled={!consistencyReportId || loading}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              consistencyReportId && !loading
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-50',
            )}
            style={{
              backgroundColor:
                consistencyReportId && !loading ? 'var(--accent-amber)' : 'var(--bg-tertiary)',
              color:
                consistencyReportId && !loading ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            <Search className="h-4 w-4" />
            检查一致性
          </button>
        </div>

        {consistencyResult && (
          <div className="mt-4">
            {consistencyResult.consistent ? (
              <div
                className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--accent-green)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <CheckCircle2 className="h-5 w-5" />
                评估说明与明细一致 ✓
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--accent-red)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <AlertTriangle className="h-5 w-5" />
                  发现不一致项 ⚠
                </div>
                <div className="flex flex-col gap-2">
                  {consistencyResult.inconsistencies.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border-l-4 border-l-red-500 p-3"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderColor: 'var(--bg-tertiary)',
                        borderLeftColor: '#EF4444',
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span style={{ color: 'var(--text-primary)' }}>
                            结论描述：
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {item.conclusion?.description ?? '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span style={{ color: 'var(--text-primary)' }}>
                            评估指标：
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {item.evaluation?.metric ?? '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span style={{ color: 'var(--text-primary)' }}>
                            不一致原因：
                          </span>
                          <span style={{ color: 'var(--accent-red)' }}>
                            {item.reason}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0">
        {changes.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-10 w-10 mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              暂无变更记录
            </p>
          </div>
        )}

        {changes.map((change, idx) => (
          <div key={change.id} className="relative flex gap-4">
            <div className="relative flex flex-col items-center">
              <div
                className="z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--accent-amber)',
                  color: 'var(--accent-amber)',
                }}
              >
                <User className="h-4 w-4" />
              </div>
              {idx < changes.length - 1 && (
                <div
                  className="w-px flex-1"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              )}
            </div>

            <div className="flex-1 pb-6">
              <div
                className="rounded-lg border p-4"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--bg-tertiary)',
                }}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {formatTime(change.operated_at)}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {change.operator}
                  </span>
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs font-medium',
                      entityTypeColors[change.entity_type as EntityType],
                    )}
                  >
                    {entityTypeLabels[change.entity_type as EntityType] ?? change.entity_type}
                  </span>
                  {change.report_id && (
                    <a
                      href={`/reports/${change.report_id}`}
                      className="flex items-center gap-1 text-xs transition-colors hover:underline"
                      style={{ color: 'var(--accent-amber)' }}
                    >
                      <FileText className="h-3 w-3" />
                      关联报告
                    </a>
                  )}
                </div>

                <div className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {change.field_name}
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 rounded-md px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#FCA5A5',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <span className="mr-1 text-xs" style={{ color: 'var(--accent-red)' }}>
                      旧值
                    </span>
                    {change.old_value || '空'}
                  </div>

                  <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />

                  <div
                    className="flex-1 rounded-md px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#6EE7B7',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <span className="mr-1 text-xs" style={{ color: 'var(--accent-green)' }}>
                      新值
                    </span>
                    {change.new_value || '空'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--accent-amber)', borderTopColor: 'transparent' }}
            />
            <span className="ml-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              加载中...
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
