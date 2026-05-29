import { useEffect, useState } from 'react'
import { Filter, RotateCcw, Upload, ChevronDown, ChevronRight, Play } from 'lucide-react'
import { useCallbackStore, type CallbackRecord } from '@/store/useCallbackStore'
import StatusBadge from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

const signatureOptions = ['', 'valid', 'expired', 'invalid', 'pending']
const orderOptions = ['', 'pending', 'paid', 'failed', 'refunded', 'cancelled']
const processingOptions = ['', 'success', 'failed', 'duplicate', 'pending']
const confirmOptions = ['', 'confirmed', 'pending', 'rejected']

export default function Callbacks() {
  const store = useCallbackStore()
  const {
    filters,
    setFilter,
    resetFilters,
    callbacks,
    callbacksLoading,
    callbacksTotal,
    callbacksPage,
    fetchCallbacks,
    selectedCallbackIds,
    toggleSelectCallback,
    selectAllCallbacks,
    clearSelection,
    createReplayTasks,
    importCallbacks,
    updateConfirmStatus,
  } = store

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    fetchCallbacks(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const totalPages = Math.ceil(callbacksTotal / 20)

  const handleReset = () => {
    resetFilters()
  }

  const handleAddToReplay = async () => {
    if (selectedCallbackIds.length === 0) return
    await createReplayTasks(selectedCallbackIds)
    clearSelection()
  }

  const handleImport = async () => {
    try {
      const records = JSON.parse(importText)
      setImporting(true)
      await importCallbacks(records)
      setImportOpen(false)
      setImportText('')
    } catch {
      alert('JSON格式错误，请检查输入')
    } finally {
      setImporting(false)
    }
  }

  const allSelected = callbacks.length > 0 && selectedCallbackIds.length === callbacks.length

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">回调明细</h2>

      <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-[var(--color-text-secondary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">筛选条件</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="签名状态" value={filters.signature_status} options={signatureOptions} onChange={(v) => setFilter('signature_status', v)} />
          <FilterSelect label="订单状态" value={filters.order_status} options={orderOptions} onChange={(v) => setFilter('order_status', v)} />
          <FilterSelect label="处理结果" value={filters.processing_result} options={processingOptions} onChange={(v) => setFilter('processing_result', v)} />
          <FilterSelect label="确认状态" value={filters.confirm_status} options={confirmOptions} onChange={(v) => setFilter('confirm_status', v)} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">开始日期</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter('from', e.target.value)}
              className="h-8 rounded border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-primary)] px-2 text-xs font-mono text-[var(--color-text-primary)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">结束日期</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter('to', e.target.value)}
              className="h-8 rounded border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-primary)] px-2 text-xs font-mono text-[var(--color-text-primary)]"
            />
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 h-8 px-3 rounded border border-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)] transition-colors"
          >
            <RotateCcw size={12} />
            重置
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddToReplay}
            disabled={selectedCallbackIds.length === 0}
            className={cn(
              'flex items-center gap-1 h-8 px-3 rounded text-xs font-medium transition-colors',
              selectedCallbackIds.length > 0
                ? 'bg-[var(--color-amber)] text-[var(--color-bg-primary)] hover:opacity-90'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] cursor-not-allowed'
            )}
          >
            <Play size={12} />
            加入重放队列 ({selectedCallbackIds.length})
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 h-8 px-3 rounded border border-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)] transition-colors"
          >
            <Upload size={12} />
            导入
          </button>
        </div>
        <span className="text-xs text-[var(--color-text-secondary)] font-mono">
          共 {callbacksTotal} 条
        </span>
      </div>

      <div className="rounded-lg border border-[var(--color-bg-tertiary)] overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <th className="px-3 py-2.5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => allSelected ? clearSelection() : selectAllCallbacks()}
                    className="rounded border-[var(--color-border)]"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">ID</th>
                <th className="px-3 py-2.5 text-left font-medium">订单号</th>
                <th className="px-3 py-2.5 text-left font-medium">签名状态</th>
                <th className="px-3 py-2.5 text-left font-medium">重试次数</th>
                <th className="px-3 py-2.5 text-left font-medium">订单状态</th>
                <th className="px-3 py-2.5 text-left font-medium">处理结果</th>
                <th className="px-3 py-2.5 text-left font-medium">确认状态</th>
                <th className="px-3 py-2.5 text-left font-medium">时间</th>
                <th className="px-3 py-2.5 text-left font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {callbacksLoading && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">
                    加载中...
                  </td>
                </tr>
              )}
              {!callbacksLoading && callbacks.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">
                    无数据
                  </td>
                </tr>
              )}
              {callbacks.map((cb) => (
                <Row
                  key={cb.id}
                  cb={cb}
                  expanded={expandedId === cb.id}
                  onToggleExpand={() => setExpandedId(expandedId === cb.id ? null : cb.id)}
                  selected={selectedCallbackIds.includes(cb.id)}
                  onToggleSelect={() => toggleSelectCallback(cb.id)}
                  onUpdateConfirm={updateConfirmStatus}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)] font-mono">
          第 {callbacksPage} / {totalPages || 1} 页
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCallbacks(Math.max(1, callbacksPage - 1))}
            disabled={callbacksPage <= 1}
            className="h-8 px-3 rounded border border-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] disabled:opacity-40 hover:text-[var(--color-text-primary)] transition-colors"
          >
            上一页
          </button>
          <button
            onClick={() => fetchCallbacks(Math.min(totalPages, callbacksPage + 1))}
            disabled={callbacksPage >= totalPages}
            className="h-8 px-3 rounded border border-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] disabled:opacity-40 hover:text-[var(--color-text-primary)] transition-colors"
          >
            下一页
          </button>
        </div>
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setImportOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">导入回调数据</h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='[{"id":"cb_001","order_id":"ORD-001",...}]'
              className="w-full h-48 rounded border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-primary)] p-3 font-mono text-xs text-[var(--color-text-primary)] resize-none scrollbar-thin"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setImportOpen(false)}
                className="h-8 px-4 rounded border border-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="h-8 px-4 rounded bg-[var(--color-amber)] text-xs font-medium text-[var(--color-bg-primary)] hover:opacity-90 disabled:opacity-60 transition-colors"
              >
                {importing ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-primary)] px-2 text-xs font-mono text-[var(--color-text-primary)]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt || '全部'}</option>
        ))}
      </select>
    </div>
  )
}

function Row({ cb, expanded, onToggleExpand, selected, onToggleSelect, onUpdateConfirm }: {
  cb: CallbackRecord
  expanded: boolean
  onToggleExpand: () => void
  selected: boolean
  onToggleSelect: () => void
  onUpdateConfirm: (id: string, status: string, note?: string) => Promise<void>
}) {
  return (
    <>
      <tr className="border-t border-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
        <td className="px-3 py-2.5">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-[var(--color-border)]" />
        </td>
        <td className="px-3 py-2.5 font-mono text-xs">{cb.id}</td>
        <td className="px-3 py-2.5 font-mono text-xs">{cb.order_id}</td>
        <td className="px-3 py-2.5"><StatusBadge status={cb.signature_status} type="signature" /></td>
        <td className="px-3 py-2.5 font-mono text-xs">{cb.retry_count}</td>
        <td className="px-3 py-2.5"><StatusBadge status={cb.order_status} type="order" /></td>
        <td className="px-3 py-2.5"><StatusBadge status={cb.processing_result} type="processing" /></td>
        <td className="px-3 py-2.5">
          <select
            value={cb.confirm_status}
            onChange={(e) => onUpdateConfirm(cb.id, e.target.value)}
            className="h-6 rounded border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-primary)] px-1 text-xs font-mono text-[var(--color-text-primary)]"
          >
            <option value="confirmed">confirmed</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </select>
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
          {new Date(cb.timestamp).toLocaleString('zh-CN')}
        </td>
        <td className="px-3 py-2.5">
          <button onClick={onToggleExpand} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-[var(--color-bg-tertiary)] bg-[var(--color-bg-primary)]">
          <td colSpan={10} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">raw_payload</p>
                <pre className="font-mono text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] rounded p-3 overflow-x-auto scrollbar-thin max-h-40">
                  {cb.raw_payload ? JSON.stringify(JSON.parse(cb.raw_payload), null, 2) : '-'}
                </pre>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">confirm_note</p>
                <p className="font-mono text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] rounded p-3">
                  {cb.confirm_note || '无备注'}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
