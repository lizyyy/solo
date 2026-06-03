import { useState } from 'react'
import { Clock, FileText, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { useStore } from '@/store'

const STEP_LABELS: Record<string, string> = {
  import_tax_rate: '税费率备注导入',
  supplementary_counter_flow: '柜台流水尾号补录',
  conflict_resolved: '冲突处理',
  review_passed: '托管复核',
  audit_update: '审计更新',
}

const STEP_COLORS: Record<string, string> = {
  import_tax_rate: '#1B2A4A',
  supplementary_counter_flow: '#2D9B83',
  conflict_resolved: '#D4A843',
  review_passed: '#2E4168',
  audit_update: '#2D9B83',
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

function EvidencePanel({ log, record }: { log: import('@/types').AuditLog; record: import('@/types').TrustRecord }) {
  const [open, setOpen] = useState(false)

  let evidenceDetail: React.ReactNode = null

  if (log.step === 'import_tax_rate' && record.taxRateRemark) {
    const t = record.taxRateRemark
    evidenceDetail = (
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">税费率</span>
          <span>{t.taxRate}%</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">备注</span>
          <span>{t.remark}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">来源文件</span>
          <span>{t.sourceFile}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">导入人</span>
          <span>{t.importedBy}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">导入时间</span>
          <span>{formatTimestamp(t.importedAt)}</span>
        </div>
      </div>
    )
  }

  if (log.step === 'supplementary_counter_flow' && record.counterFlowTail) {
    const c = record.counterFlowTail
    evidenceDetail = (
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">尾号</span>
          <span>{c.tailNumber}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">旧口径金额</span>
          <span>{c.oldStandardAmount.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">币种</span>
          <span>{c.currency}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">补录人</span>
          <span>{c.supplementaryBy}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">补录时间</span>
          <span>{formatTimestamp(c.supplementaryAt)}</span>
        </div>
      </div>
    )
  }

  if (log.step === 'conflict_resolved') {
    const conflicts = useStore.getState().getConflictsByRecord(record.id)
    const conflict = conflicts.find((c) => c.id === log.evidenceRef)
    if (conflict) {
      evidenceDetail = (
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 shrink-0">税费率备注</span>
            <span>{conflict.taxRateRemarkValue}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 shrink-0">柜台流水</span>
            <span>{conflict.counterFlowTailValue}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 shrink-0">冲突字段</span>
            <span>{conflict.conflictField}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 shrink-0">处理结果</span>
            <span>{conflict.resolution === 'confirmed' ? '已确认' : conflict.resolution === 'rejected' ? '已驳回' : '待处理'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 shrink-0">描述</span>
            <span>{conflict.conflictDescription}</span>
          </div>
        </div>
      )
    }
  }

  if (log.step === 'audit_update') {
    evidenceDetail = (
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">当前状态</span>
          <span>{record.status}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">水位金额</span>
          <span>{record.waterlineAmount.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 shrink-0">币种</span>
          <span>{record.currency}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
        style={{ color: STEP_COLORS[log.step] }}
      >
        <FileText size={14} />
        查看证据
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="mt-2 ml-5 pl-3 border-l-2 py-2 space-y-1" style={{ borderColor: STEP_COLORS[log.step] + '40' }}>
          <div className="flex gap-2 text-xs text-gray-400 mb-2">
            <span>证据编号</span>
            <span className="font-mono">{log.evidenceRef}</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">{log.detail}</div>
          {evidenceDetail}
        </div>
      )}
    </div>
  )
}

function HistoryComparison({ record }: { record: import('@/types').TrustRecord }) {
  if (!record.taxRateRemark || !record.counterFlowTail) return null

  const taxRate = record.taxRateRemark.taxRate
  const counterRate = record.counterFlowTail.oldStandardAmount > 0
    ? (() => {
        const conflicts = useStore.getState().getConflictsByRecord(record.id)
        const conflict = conflicts.find((c) => c.conflictField === '税费率')
        return conflict ? parseFloat(conflict.counterFlowTailValue) : taxRate
      })()
    : taxRate

  const rows = [
    { label: '货币', taxVal: record.taxRateRemark.remark.includes('海外') ? record.currency : record.counterFlowTail.currency, counterVal: record.counterFlowTail.currency },
    { label: '税费率', taxVal: `${record.taxRateRemark.taxRate}%`, counterVal: `${counterRate}%` },
    { label: '金额', taxVal: record.waterlineAmount.toLocaleString(), counterVal: record.counterFlowTail.oldStandardAmount.toLocaleString() },
  ]

  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-gray-800 mb-4">历史对照</h3>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-24" />
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">税费率备注口径</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">柜台流水尾号口径</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = row.taxVal !== row.counterVal
              return (
                <tr
                  key={row.label}
                  className={diff ? 'bg-amber-50 border-l-4 border-l-amber-500' : 'border-l-4 border-l-transparent'}
                >
                  <td className="px-4 py-2.5 text-gray-500">{row.label}</td>
                  <td className="px-4 py-2.5">{row.taxVal}</td>
                  <td className="px-4 py-2.5">{row.counterVal}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Audit() {
  const records = useStore((s) => s.records)
  const getAuditLogsByRecord = useStore((s) => s.getAuditLogsByRecord)
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? '')

  const selectedRecord = records.find((r) => r.id === selectedId)
  const logs = selectedId ? getAuditLogsByRecord(selectedId) : []

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={22} className="text-gray-700" />
        <h1 className="text-xl font-bold text-gray-800">审计追溯</h1>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-600 mb-1.5">选择记录</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        >
          {records.map((r) => (
            <option key={r.id} value={r.id}>{r.productName}</option>
          ))}
        </select>
      </div>

      {selectedRecord && logs.length > 0 && (
        <div className="mb-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">操作时间线</h2>
          <div className="relative ml-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-0">
              {logs.map((log, idx) => {
                const color = STEP_COLORS[log.step] ?? '#6B7280'
                const isLast = idx === logs.length - 1
                return (
                  <div key={log.id} className="relative pl-8 pb-6">
                    <div
                      className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    {!isLast && (
                      <div className="absolute left-[7px] top-5 bottom-0 w-0.5" style={{ backgroundColor: color + '30' }} />
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color }}>
                        {STEP_LABELS[log.step] ?? log.step}
                      </span>
                      <ArrowRight size={12} className="text-gray-300" />
                      <span className="text-xs text-gray-400">{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-0.5">
                      {log.operator} · {log.role}
                    </div>
                    <div className="text-sm text-gray-600">{log.detail}</div>
                    <EvidencePanel log={log} record={selectedRecord} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {selectedRecord && <HistoryComparison record={selectedRecord} />}
    </div>
  )
}
