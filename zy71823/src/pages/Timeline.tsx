import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { SEED_EVIDENCES } from '@/data/seed'
import { Camera, FileText, PenLine, Filter } from 'lucide-react'
import type { EvidenceType, AuditStatus, JudgmentType } from '@/types'
import { TYPE_LABELS, JUDGMENT_LABELS, STATUS_LABELS } from '@/types'

const TYPE_ICONS: Record<EvidenceType, typeof Camera> = {
  screenshot: Camera,
  review: FileText,
  draft: PenLine,
}

const TYPE_COLORS: Record<EvidenceType, string> = {
  screenshot: 'text-sky-400',
  review: 'text-violet-400',
  draft: 'text-orange-400',
}

const JUDGMENT_COLORS: Record<JudgmentType, string> = {
  supplementary: 'bg-emerald-900/60 text-emerald-300',
  conclusion_changed: 'bg-amber-900/60 text-amber-300',
}

const STATUS_COLORS: Record<AuditStatus, string> = {
  pending: 'bg-slate-800 text-slate-300',
  confirmed: 'bg-zinc-700 text-zinc-300',
  rejected: 'bg-rose-900/60 text-rose-300',
}

type FilterType = 'all' | EvidenceType
type FilterStatus = 'all' | AuditStatus | JudgmentType

export default function Timeline() {
  const evidences = useAppStore((s) => s.evidences)
  const auditResults = useAppStore((s) => s.auditResults)
  const addEvidence = useAppStore((s) => s.addEvidence)

  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const loadSeed = () => {
    SEED_EVIDENCES.forEach((e) => addEvidence(e))
  }

  const getAuditForEvidence = (id: string) =>
    auditResults.find((r) => r.evidenceId === id)

  const sorted = [...evidences].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const filtered = sorted.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false
    if (filterStatus !== 'all') {
      const audit = getAuditForEvidence(e.id)
      if (filterStatus === 'pending' || filterStatus === 'confirmed' || filterStatus === 'rejected') {
        if (!audit || audit.status !== filterStatus) return false
      }
      if (filterStatus === 'supplementary' || filterStatus === 'conclusion_changed') {
        if (!audit || audit.judgment !== filterStatus) return false
      }
    }
    return true
  })

  const totalCount = evidences.length
  const pendingCount = auditResults.filter((r) => r.status === 'pending').length
  const changedCount = auditResults.filter(
    (r) => r.judgment === 'conclusion_changed'
  ).length
  const confirmedCount = auditResults.filter(
    (r) => r.status === 'confirmed'
  ).length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-50">时间线总览</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            排行榜截图 · 活动复盘 · 关卡草表 — 同线可查
          </p>
        </div>
        {evidences.length === 0 && (
          <button
            onClick={loadSeed}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
          >
            加载试跑数据
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="证据总数" value={totalCount} color="text-zinc-100" />
        <StatCard label="待对账" value={pendingCount} color="text-slate-300" />
        <StatCard label="改了结论" value={changedCount} color="text-amber-400" />
        <StatCard label="已确认" value={confirmedCount} color="text-emerald-400" />
      </div>

      <div className="flex items-center gap-2 mb-5">
        <Filter size={13} className="text-zinc-500" />
        <div className="flex gap-1.5">
          {(['all', 'screenshot', 'review', 'draft'] as FilterType[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  filterType === t
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'all' ? '全部来源' : TYPE_LABELS[t]}
              </button>
            )
          )}
        </div>
        <span className="text-zinc-700 mx-1">|</span>
        <div className="flex gap-1.5">
          {(
            ['all', 'pending', 'supplementary', 'conclusion_changed', 'confirmed'] as FilterStatus[]
          ).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                filterStatus === s
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s === 'all'
                ? '全部状态'
                : s === 'supplementary'
                ? JUDGMENT_LABELS.supplementary
                : s === 'conclusion_changed'
                ? JUDGMENT_LABELS.conclusion_changed
                : STATUS_LABELS[s as AuditStatus]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">
          {evidences.length === 0
            ? '暂无证据数据，点击右上角"加载试跑数据"开始'
            : '无匹配结果'}
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-zinc-800" />
          {filtered.map((item, idx) => {
            const Icon = TYPE_ICONS[item.type]
            const audit = getAuditForEvidence(item.id)
            const isLast = idx === filtered.length - 1

            return (
              <div key={item.id} className={`relative ${isLast ? '' : 'pb-5'}`}>
                <div
                  className={`absolute left-[-15px] top-1.5 w-[18px] h-[18px] rounded-full border-2 ${
                    item.type === 'screenshot'
                      ? 'border-sky-500 bg-zinc-950'
                      : item.type === 'review'
                      ? 'border-violet-500 bg-zinc-950'
                      : 'border-orange-500 bg-zinc-950'
                  } flex items-center justify-center`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.type === 'screenshot'
                        ? 'bg-sky-500'
                        : item.type === 'review'
                        ? 'bg-violet-500'
                        : 'bg-orange-500'
                    }`}
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className={TYPE_COLORS[item.type]} />
                    <span className="text-xs text-zinc-500">
                      {TYPE_LABELS[item.type]}
                    </span>
                    {item.changeType && (
                      <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {item.changeType === 'new'
                          ? '新增'
                          : item.changeType === 'modify'
                          ? '修改'
                          : '删除'}
                      </span>
                    )}
                    <span className="text-xs text-zinc-600 ml-auto">
                      {new Date(item.timestamp).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-zinc-200 mb-1">
                    {item.activityName}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {item.content}
                  </p>
                  {item.attachmentUrl && (
                    <div className="mt-2">
                      <img
                        src={item.attachmentUrl}
                        alt="附件"
                        className="h-24 rounded border border-zinc-800 object-cover"
                      />
                    </div>
                  )}
                  {audit && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-800/60">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          JUDGMENT_COLORS[audit.judgment]
                        }`}
                      >
                        {JUDGMENT_LABELS[audit.judgment]}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          STATUS_COLORS[audit.status]
                        }`}
                      >
                        {STATUS_LABELS[audit.status]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  )
}
