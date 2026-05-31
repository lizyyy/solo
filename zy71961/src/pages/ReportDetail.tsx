import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  AlertTriangle,
  FileText,
  BarChart3,
  Edit3,
  Clock,
  X,
  Link2,
  Tag,
  FolderOpen,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  Send,
  ExternalLink,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { fetchSample, fetchEvaluation } from '@/api/client'
import { cn } from '@/lib/utils'
import type { AnnotationSample, Evaluation, ConclusionSource, Severity } from '@/types'

const severityLabel: Record<Severity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
}

type DrawerData =
  | { type: 'sample'; data: AnnotationSample; linkedSources: any[] }
  | { type: 'evaluation'; data: Evaluation; linkedSources: any[] }

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentReport, loading, loadReport, createChange } = useAppStore()

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [correctionForm, setCorrectionForm] = useState({
    entityType: 'conclusion' as string,
    entityId: '',
    fieldName: '',
    oldValue: '',
    newValue: '',
    operator: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) loadReport(id)
  }, [id])

  const toggleRow = (conclusionId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(conclusionId)) next.delete(conclusionId)
      else next.add(conclusionId)
      return next
    })
  }

  const openDrawer = useCallback(async (source: ConclusionSource) => {
    setDrawerClosing(false)
    setDrawerLoading(true)
    setDrawerOpen(true)
    try {
      if (source.sample_id) {
        const res = await fetchSample(source.sample_id)
        setDrawerData({ type: 'sample', data: res.sample, linkedSources: res.linkedSources })
      } else if (source.evaluation_id) {
        const res = await fetchEvaluation(source.evaluation_id)
        setDrawerData({ type: 'evaluation', data: res.evaluation, linkedSources: res.linkedSources })
      }
    } catch {
      setDrawerData(null)
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerClosing(true)
    setTimeout(() => {
      setDrawerOpen(false)
      setDrawerClosing(false)
      setDrawerData(null)
    }, 200)
  }, [])

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctionForm.entityId || !correctionForm.fieldName || !correctionForm.operator) return
    setSubmitting(true)
    try {
      await createChange({
        entityType: correctionForm.entityType,
        entityId: correctionForm.entityId,
        reportId: id,
        fieldName: correctionForm.fieldName,
        oldValue: correctionForm.oldValue,
        newValue: correctionForm.newValue,
        operator: correctionForm.operator,
      })
      setCorrectionForm({
        entityType: 'conclusion',
        entityId: '',
        fieldName: '',
        oldValue: '',
        newValue: '',
        operator: '',
      })
      if (id) loadReport(id)
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !currentReport) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</span>
        </div>
      </div>
    )
  }

  if (!currentReport) {
    return (
      <div className="flex h-full items-center justify-center">
        <span style={{ color: 'var(--text-muted)' }}>未找到报告数据</span>
      </div>
    )
  }

  const { report, conclusions, evaluations, changeHistory } = currentReport

  const driftColor = (drift: number) => {
    if (drift > 0) return 'var(--accent-green)'
    if (drift < 0) return 'var(--accent-red)'
    return 'var(--text-muted)'
  }

  const driftIcon = (drift: number) => {
    if (drift > 0) return <TrendingUp className="h-3.5 w-3.5" />
    if (drift < 0) return <TrendingDown className="h-3.5 w-3.5" />
    return <Minus className="h-3.5 w-3.5" />
  }

  const sourceLabel = (source: ConclusionSource) => {
    if (source.sample_id) return '标注样本'
    if (source.evaluation_id) return '评估指标'
    return '原始记录'
  }

  return (
    <div className="relative mx-auto max-w-5xl pb-12">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      <div
        className="mb-6 rounded-lg border border-[var(--bg-tertiary)] p-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                日报详情
              </h1>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  `severity-${report.severity}`,
                )}
              >
                {severityLabel[report.severity]}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                日期：{report.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4" />
                模型：{report.model_name || report.model_id}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                创建于：{new Date(report.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="mb-6 rounded-lg border border-[var(--bg-tertiary)]"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--bg-tertiary)] px-5 py-3">
          <AlertTriangle className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            结论列表
          </h2>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
            共 {conclusions.length} 条
          </span>
        </div>
        <div className="divide-y divide-[var(--bg-tertiary)]">
          {conclusions.map((conclusion) => {
            const expanded = expandedRows.has(conclusion.id)
            return (
              <div key={conclusion.id}>
                <button
                  onClick={() => toggleRow(conclusion.id)}
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-secondary)]"
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      `severity-${conclusion.severity}`,
                    )}
                  >
                    {severityLabel[conclusion.severity]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {conclusion.title}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {conclusion.description}
                    </p>
                  </div>
                  {conclusion.sources && conclusion.sources.length > 0 && (
                    <span
                      className="mt-1 flex-shrink-0 rounded-md px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: 'var(--accent-amber)',
                      }}
                    >
                      {conclusion.sources.length} 条溯源
                    </span>
                  )}
                </button>
                {expanded && conclusion.sources && conclusion.sources.length > 0 && (
                  <div className="px-5 pb-4 pl-12">
                    <div
                      className="rounded-md border border-[var(--bg-tertiary)] p-3"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        溯源依据
                      </p>
                      <div className="flex flex-col gap-2">
                        {conclusion.sources.map((source) => (
                          <button
                            key={source.id}
                            onClick={() => openDrawer(source)}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <Link2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-amber)' }} />
                            <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {sourceLabel(source)}
                            </span>
                            <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                              {source.sample_id || source.evaluation_id || source.record_id}
                            </span>
                            <ExternalLink className="ml-auto h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {conclusions.length === 0 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              暂无结论数据
            </div>
          )}
        </div>
      </div>

      <div
        className="mb-6 rounded-lg border border-[var(--bg-tertiary)]"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--bg-tertiary)] px-5 py-3">
          <BarChart3 className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            评估指标
          </h2>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
            共 {evaluations.length} 项
          </span>
        </div>
        {evaluations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--bg-tertiary)] text-left text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <th className="px-5 py-3 font-medium">指标名称</th>
                  <th className="px-5 py-3 font-medium">当前值</th>
                  <th className="px-5 py-3 font-medium">基线值</th>
                  <th className="px-5 py-3 font-medium">漂移量</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bg-tertiary)]">
                {evaluations.map((evaluation) => (
                  <tr key={evaluation.id} className="transition-colors hover:bg-[var(--bg-secondary)]">
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {evaluation.metric}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {evaluation.value.toFixed(4)}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {evaluation.baseline.toFixed(4)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1" style={{ color: driftColor(evaluation.drift) }}>
                        {driftIcon(evaluation.drift)}
                        {evaluation.drift > 0 ? '+' : ''}
                        {evaluation.drift.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() =>
                          openDrawer({
                            id: '',
                            conclusion_id: '',
                            record_id: null,
                            sample_id: null,
                            evaluation_id: evaluation.id,
                          })
                        }
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--accent-amber)' }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            暂无评估数据
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div
          className="rounded-lg border border-[var(--bg-tertiary)]"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--bg-tertiary)] px-5 py-3">
            <Edit3 className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              手动修正
            </h2>
          </div>
          <form onSubmit={handleCorrectionSubmit} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  实体类型
                </label>
                <select
                  value={correctionForm.entityType}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, entityType: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="conclusion">结论</option>
                  <option value="evaluation">评估</option>
                  <option value="feedback">反馈</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  实体 ID
                </label>
                <input
                  value={correctionForm.entityId}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, entityId: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="输入实体 ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  字段名称
                </label>
                <input
                  value={correctionForm.fieldName}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, fieldName: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="输入字段名"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  操作人
                </label>
                <input
                  value={correctionForm.operator}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, operator: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="输入操作人"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  旧值
                </label>
                <input
                  value={correctionForm.oldValue}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, oldValue: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="输入旧值"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  新值
                </label>
                <input
                  value={correctionForm.newValue}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, newValue: e.target.value }))
                  }
                  className="w-full rounded-md border border-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="输入新值"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent-amber)',
                color: 'var(--bg-primary)',
              }}
            >
              <Send className="h-4 w-4" />
              {submitting ? '提交中...' : '提交修正'}
            </button>
          </form>
        </div>

        <div
          className="rounded-lg border border-[var(--bg-tertiary)]"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--bg-tertiary)] px-5 py-3">
            <Clock className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              变更记录
            </h2>
            <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
              最近 {Math.min(changeHistory.length, 10)} 条
            </span>
          </div>
          <div className="divide-y divide-[var(--bg-tertiary)]">
            {changeHistory.slice(0, 10).map((change) => (
              <div key={change.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {change.entity_type === 'conclusion'
                      ? '结论'
                      : change.entity_type === 'evaluation'
                        ? '评估'
                        : '反馈'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {change.entity_id.slice(0, 8)}
                  </span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                    {change.operator}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{change.field_name}</span>
                  {'：'}
                  <span style={{ color: 'var(--accent-red)' }}>{change.old_value}</span>
                  {' → '}
                  <span style={{ color: 'var(--accent-green)' }}>{change.new_value}</span>
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(change.operated_at).toLocaleString('zh-CN')}
                </p>
              </div>
            ))}
            {changeHistory.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                暂无变更记录
              </div>
            )}
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className={cn('absolute inset-0', drawerClosing ? 'overlay-exit' : 'overlay-enter')}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={closeDrawer}
          />
          <div
            className={cn(
              'absolute bottom-0 right-0 top-0 flex w-[420px] flex-col border-l border-[var(--bg-tertiary)]',
              drawerClosing ? 'drawer-panel-exit' : 'drawer-panel-enter',
            )}
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <div className="flex items-center justify-between border-b border-[var(--bg-tertiary)] px-5 py-4">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {drawerData?.type === 'sample' ? '标注样本详情' : '评估指标详情'}
              </h3>
              <button
                onClick={closeDrawer}
                className="rounded-md p-1 transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
                </div>
              ) : drawerData ? (
                <div className="flex flex-col gap-5">
                  {drawerData.type === 'sample' && (
                    <>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-amber)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>标签</span>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {drawerData.data.label}
                          </p>
                        </div>
                      </div>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-amber)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>内容</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {drawerData.data.content}
                          </p>
                        </div>
                      </div>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>文件路径</span>
                            </div>
                          </div>
                          <code
                            className="rounded bg-[var(--bg-primary)] px-2 py-1 text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {drawerData.data.file_path || '无'}
                          </code>
                        </div>
                      </div>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>所属模型</span>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {drawerData.data.model_name || drawerData.data.model_id}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {drawerData.type === 'evaluation' && (
                    <>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-amber)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>指标</span>
                          </div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {drawerData.data.metric}
                          </p>
                        </div>
                      </div>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="grid grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>当前值</span>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {drawerData.data.value.toFixed(4)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>基线值</span>
                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {drawerData.data.baseline.toFixed(4)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>漂移量</span>
                            <span
                              className="flex items-center gap-1 text-sm font-medium"
                              style={{ color: driftColor(drawerData.data.drift) }}
                            >
                              {driftIcon(drawerData.data.drift)}
                              {drawerData.data.drift > 0 ? '+' : ''}
                              {drawerData.data.drift.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="rounded-md border border-[var(--bg-tertiary)] p-4"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>所属模型</span>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {drawerData.data.model_name || drawerData.data.model_id}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {drawerData.linkedSources && drawerData.linkedSources.length > 0 && (
                    <div
                      className="rounded-md border border-[var(--bg-tertiary)] p-4"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          被引用于
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {drawerData.linkedSources.map((src: any, idx: number) => (
                          <div
                            key={src.id || idx}
                            className="flex items-center gap-2 rounded bg-[var(--bg-primary)] px-3 py-2"
                          >
                            <span
                              className="rounded px-1.5 py-0.5 text-xs"
                              style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              结论
                            </span>
                            <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {src.conclusion_id?.slice(0, 8) || `引用 #${idx + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  加载失败
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
