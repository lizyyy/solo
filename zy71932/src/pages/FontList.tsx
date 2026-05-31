import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import { StatusBadge } from '@/components/StatusBadge'
import {
  Search,
  Filter,
  CheckCircle2,
  X as XIcon,
  Trash2,
  Link2,
  ChevronRight,
  RotateCcw,
  MessageSquare,
  FileText,
} from 'lucide-react'
import type { RecordStatus, LicenseType, FontRecord } from '@/types'

export default function FontList() {
  const { records, colorCards, operationLogs, batchUpdateStatus, revokeOperation, deleteRecord, addReviewNote, linkColorCard } = useStore()
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status') as RecordStatus | null

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RecordStatus[]>(statusParam ? [statusParam] : [])
  const [licenseFilter, setLicenseFilter] = useState<LicenseType[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('设计师')

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false
      if (licenseFilter.length > 0 && !licenseFilter.includes(r.licenseType)) return false
      if (search) {
        const s = search.toLowerCase()
        if (!r.fontName.toLowerCase().includes(s) && !r.foundry.toLowerCase().includes(s) && !r.customNotes.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [records, statusFilter, licenseFilter, search])

  const detailRecord = detailId ? records.find((r) => r.id === detailId) : null
  const detailLogs = detailId ? operationLogs.filter((l) => l.recordId === detailId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) : []

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((r) => r.id)))
  }

  const handleBatchStatus = (status: RecordStatus) => {
    if (selected.size === 0) return
    batchUpdateStatus(Array.from(selected), status)
    setSelected(new Set())
  }

  const handleBatchDelete = () => {
    if (selected.size === 0) return
    for (const id of selected) {
      deleteRecord(id)
    }
    setSelected(new Set())
  }

  const handleAddNote = () => {
    if (!detailId || !noteInput.trim()) return
    addReviewNote(detailId, noteInput.trim(), noteAuthor)
    setNoteInput('')
  }

  const handleLinkCard = (recordId: string, cardId: string) => {
    const card = colorCards.find((c) => c.id === cardId)
    if (card) linkColorCard(recordId, cardId, card.version)
  }

  const statuses: RecordStatus[] = ['confirmed', 'pending', 'expired', 'conflict']
  const licenseTypes: LicenseType[] = ['商业', '个人', '开源', '自定义']
  const statusLabels: Record<RecordStatus, string> = { confirmed: '已确认', pending: '待确认', expired: '已过期', conflict: '冲突' }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">字体授权列表</h2>
              <p className="text-sm text-zinc-500 mt-0.5">共 {filtered.length} 条 / 全部 {records.length} 条</p>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">已选 {selected.size} 项</span>
                <button onClick={() => handleBatchStatus('confirmed')} className="btn-confirm">
                  <CheckCircle2 size={14} /> 批量确认
                </button>
                <button onClick={() => handleBatchStatus('pending')} className="btn-secondary">
                  标为待确认
                </button>
                <button onClick={handleBatchDelete} className="btn-danger">
                  <Trash2 size={14} /> 删除
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索字体名称、厂商..."
                className="input pl-8 w-full"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-zinc-500" />
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    statusFilter.includes(s) ? 'bg-amber/15 text-amber' : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-100'
                  }`}
                >
                  {statusLabels[s]}
                </button>
              ))}
              <span className="text-zinc-600 mx-1">|</span>
              {licenseTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setLicenseFilter((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    licenseFilter.includes(t) ? 'bg-amber/15 text-amber' : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-surface-50/95 backdrop-blur-sm z-10">
              <tr className="border-b border-surface-200 text-left text-xs text-zinc-500">
                <th className="py-2.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-surface-300 bg-surface-200 accent-amber"
                  />
                </th>
                <th className="py-2.5 px-4 font-medium">字体名称</th>
                <th className="py-2.5 px-4 font-medium">厂商</th>
                <th className="py-2.5 px-4 font-medium">授权类型</th>
                <th className="py-2.5 px-4 font-medium">到期日</th>
                <th className="py-2.5 px-4 font-medium">色卡</th>
                <th className="py-2.5 px-4 font-medium">状态</th>
                <th className="py-2.5 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const card = r.colorCardId ? colorCards.find((c) => c.id === r.colorCardId) : null
                const borderColor =
                  r.status === 'expired' ? 'border-l-danger' :
                  r.status === 'conflict' ? 'border-l-purple-400' :
                  r.status === 'pending' ? 'border-l-amber' : 'border-l-confirm'
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-surface-200/50 border-l-2 ${borderColor} hover:bg-surface-100/40 transition-colors cursor-pointer ${
                      detailId === r.id ? 'bg-surface-100/60' : ''
                    }`}
                    onClick={() => setDetailId(detailId === r.id ? null : r.id)}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="rounded border-surface-300 bg-surface-200 accent-amber"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-zinc-200 font-medium font-mono">{r.fontName}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-400">{r.foundry}</td>
                    <td className="py-3 px-4 text-sm text-zinc-400">{r.licenseType}</td>
                    <td className="py-3 px-4 text-sm font-mono text-zinc-400">{r.expiryDate || <span className="text-amber">缺失</span>}</td>
                    <td className="py-3 px-4">
                      {card ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1">
                            {card.colorValues.slice(0, 3).map((c, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded-sm border border-surface-200"
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-zinc-500 font-mono">v{r.colorCardVersion}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">未关联</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight size={14} className="text-zinc-600" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-zinc-500">无匹配记录</div>
          )}
        </div>
      </div>

      {detailRecord && (
        <DetailSidebar
          record={detailRecord}
          logs={detailLogs}
          colorCards={colorCards}
          onClose={() => setDetailId(null)}
          onAddNote={handleAddNote}
          noteInput={noteInput}
          setNoteInput={setNoteInput}
          noteAuthor={noteAuthor}
          setNoteAuthor={setNoteAuthor}
          onLinkCard={handleLinkCard}
          onRevoke={revokeOperation}
          onDelete={(id) => { deleteRecord(id); setDetailId(null) }}
        />
      )}
    </div>
  )
}

function DetailSidebar({
  record,
  logs,
  colorCards,
  onClose,
  onAddNote,
  noteInput,
  setNoteInput,
  noteAuthor,
  setNoteAuthor,
  onLinkCard,
  onRevoke,
  onDelete,
}: {
  record: FontRecord
  logs: { id: string; action: string; detail: string; timestamp: string; operator: string; previousValue?: unknown }[]
  colorCards: { id: string; name: string; version: string; colorValues: { hex: string; name: string }[] }[]
  onClose: () => void
  onAddNote: () => void
  noteInput: string
  setNoteInput: (v: string) => void
  noteAuthor: string
  setNoteAuthor: (v: string) => void
  onLinkCard: (recordId: string, cardId: string) => void
  onRevoke: (logId: string) => void
  onDelete: (id: string) => void
}) {
  const card = record.colorCardId ? colorCards.find((c) => c.id === record.colorCardId) : null
  const unlinkedCards = colorCards.filter((c) => c.id !== record.colorCardId)

  return (
    <div className="w-[360px] border-l border-surface-200 flex flex-col overflow-hidden shrink-0 bg-surface-50/50">
      <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-zinc-200">{record.fontName}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <XIcon size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto space-y-0">
        <section className="px-4 py-3 border-b border-surface-200/50">
          <h4 className="text-xs text-zinc-500 font-medium mb-2 flex items-center gap-1.5">
            <FileText size={12} /> 基本信息
          </h4>
          <dl className="space-y-1.5 text-sm">
            <Row label="厂商" value={record.foundry} />
            <Row label="授权类型" value={record.licenseType} />
            <Row label="到期日" value={record.expiryDate || '缺失'} highlight={!record.expiryDate} />
            <Row label="使用范围" value={record.usageScope || '-'} />
            <Row label="备注" value={record.customNotes || '-'} />
          </dl>
        </section>

        <section className="px-4 py-3 border-b border-surface-200/50">
          <h4 className="text-xs text-zinc-500 font-medium mb-2 flex items-center gap-1.5">
            <Link2 size={12} /> 色卡关联
          </h4>
          {card ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-0.5">
                  {card.colorValues.map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded border border-surface-200" style={{ backgroundColor: c.hex }} title={c.name} />
                  ))}
                </div>
                <span className="text-sm text-zinc-300">{card.name}</span>
                <span className="text-xs font-mono text-zinc-500">v{card.version}</span>
                {record.colorCardVersion && record.colorCardVersion !== card.version && (
                  <span className="badge-expired">版本不一致</span>
                )}
              </div>
              {unlinkedCards.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {unlinkedCards.map((c) => (
                    <button key={c.id} onClick={() => onLinkCard(record.id, c.id)} className="text-xs px-2 py-1 rounded bg-surface-100 text-zinc-400 hover:text-zinc-200 hover:bg-surface-200 transition-colors">
                      {c.name} v{c.version}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">未关联色卡</p>
              <div className="flex flex-wrap gap-1">
                {colorCards.map((c) => (
                  <button key={c.id} onClick={() => onLinkCard(record.id, c.id)} className="text-xs px-2 py-1 rounded bg-surface-100 text-zinc-400 hover:text-zinc-200 hover:bg-surface-200 transition-colors">
                    {c.name} v{c.version}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="px-4 py-3 border-b border-surface-200/50">
          <h4 className="text-xs text-zinc-500 font-medium mb-2 flex items-center gap-1.5">
            <MessageSquare size={12} /> 审稿意见
          </h4>
          {record.reviewNotes.length === 0 ? (
            <p className="text-xs text-zinc-600">暂无</p>
          ) : (
            <div className="space-y-2">
              {record.reviewNotes.map((n) => (
                <div key={n.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300">{n.content}</span>
                    {n.resolved && <span className="badge-confirmed">已解决</span>}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{n.author} · {formatTime(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="添加意见..." className="input flex-1" onKeyDown={(e) => e.key === 'Enter' && onAddNote()} />
            <input value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} className="input w-20" placeholder="署名" />
            <button onClick={onAddNote} className="btn-primary" disabled={!noteInput.trim()}>添加</button>
          </div>
        </section>

        <section className="px-4 py-3">
          <h4 className="text-xs text-zinc-500 font-medium mb-2 flex items-center gap-1.5">
            <RotateCcw size={12} /> 操作日志
          </h4>
          {logs.length === 0 ? (
            <p className="text-xs text-zinc-600">暂无</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="text-sm flex items-start justify-between gap-2">
                  <div>
                    <span className="text-zinc-300">{log.detail}</span>
                    <div className="text-xs text-zinc-500 mt-0.5">{log.operator} · {formatTime(log.timestamp)}</div>
                  </div>
                  {log.previousValue && log.action !== 'revoke' && (
                    <button onClick={() => onRevoke(log.id)} className="text-xs text-zinc-500 hover:text-amber shrink-0">撤回</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="px-4 py-3 border-t border-surface-200 shrink-0">
        <button onClick={() => onDelete(record.id)} className="btn-danger w-full justify-center">
          <Trash2 size={14} /> 删除此记录
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-zinc-500 w-16 shrink-0">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-amber' : 'text-zinc-300'}`}>{value}</span>
    </div>
  )
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
