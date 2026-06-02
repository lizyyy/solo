import { useEffect, useState, useMemo } from 'react'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { useLocationStore } from '@/stores/locationStore'
import { usePlanStore } from '@/stores/planStore'
import {
  MessageSquare,
  GitBranch,
  Filter,
  Check,
  X,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeedbackStatus, PlanAction } from '@/types'

const STATUS_OPTIONS: { value: FeedbackStatus | '全部'; label: string }[] = [
  { value: '全部', label: '全部' },
  { value: '待处理', label: '待处理' },
  { value: '已回复', label: '已回复' },
  { value: '已关闭', label: '已关闭' },
]

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  待处理: 'bg-amber-500/20 text-amber-400',
  已回复: 'bg-teal-500/20 text-teal-400',
  已关闭: 'bg-zinc-500/20 text-zinc-400',
}

const ACTION_BADGE: Record<PlanAction, string> = {
  新增: 'bg-emerald-500/20 text-emerald-400',
  保留: 'bg-zinc-500/20 text-zinc-400',
  移除: 'bg-red-500/20 text-red-400',
  修改: 'bg-amber-500/20 text-amber-400',
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Feedback() {
  const { feedbacks, loadAll: loadFeedbacks, updateFeedbackStatus } = useFeedbackStore()
  const { locations, loadAll: loadLocations } = useLocationStore()
  const { planVersions, loadAll: loadPlans, getLocationsByPlanId } = usePlanStore()

  const [activeTab, setActiveTab] = useState<'反馈记录' | '方案版本'>('反馈记录')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | '全部'>('全部')
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)
  const [diffVersionA, setDiffVersionA] = useState<string>('')
  const [diffVersionB, setDiffVersionB] = useState<string>('')
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    loadFeedbacks()
    loadLocations()
    loadPlans()
  }, [loadFeedbacks, loadLocations, loadPlans])

  const locationMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of locations) {
      map.set(loc.id, loc.canonicalName)
    }
    return map
  }, [locations])

  const filteredFeedbacks = useMemo(() => {
    if (statusFilter === '全部') return feedbacks
    return feedbacks.filter((f) => f.status === statusFilter)
  }, [feedbacks, statusFilter])

  const sortedPlans = useMemo(
    () => [...planVersions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [planVersions]
  )

  const diffResult = useMemo(() => {
    if (!diffVersionA || !diffVersionB) return null
    const locsA = getLocationsByPlanId(diffVersionA)
    const locsB = getLocationsByPlanId(diffVersionB)

    const mapA = new Map(locsA.map((pl) => [pl.locationId, pl]))
    const mapB = new Map(locsB.map((pl) => [pl.locationId, pl]))

    const allIds = new Set([...mapA.keys(), ...mapB.keys()])
    const added: string[] = []
    const removed: string[] = []
    const modified: string[] = []
    const unchanged: string[] = []

    for (const id of allIds) {
      const inA = mapA.get(id)
      const inB = mapB.get(id)
      if (!inA && inB) {
        added.push(id)
      } else if (inA && !inB) {
        removed.push(id)
      } else if (inA && inB) {
        if (inA.action !== inB.action || inA.note !== inB.note) {
          modified.push(id)
        } else {
          unchanged.push(id)
        }
      }
    }

    return { mapA, mapB, added, removed, modified, unchanged }
  }, [diffVersionA, diffVersionB, getLocationsByPlanId])

  function handleStatusUpdate(id: string, status: FeedbackStatus) {
    updateFeedbackStatus(id, status)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <MessageSquare size={20} className="text-teal-400 flex-shrink-0" />
        <h1 className="text-lg font-semibold text-zinc-100 whitespace-nowrap">反馈与方案</h1>
        <div className="flex-1" />
        <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
          {(['反馈记录', '方案版本'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition',
                activeTab === tab
                  ? 'bg-teal-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-zinc-950">
        {activeTab === '反馈记录' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Filter size={14} className="text-zinc-500 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | '全部')}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">{filteredFeedbacks.length} 条记录</span>
            </div>

            {filteredFeedbacks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <MessageSquare size={40} className="mb-3 opacity-30" />
                <p className="text-sm">暂无反馈记录</p>
              </div>
            )}

            {filteredFeedbacks.map((fb) => (
              <div
                key={fb.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_BADGE[fb.status])}>
                      {fb.status}
                    </span>
                    <span className="text-xs text-zinc-500">{fb.source}</span>
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">{formatDateTime(fb.createdAt)}</span>
                </div>

                <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{fb.content}</p>

                <div className="flex items-center justify-between">
                  <div>
                    {fb.locationId ? (
                      <span className="inline-flex items-center gap-1 text-sm text-teal-400 cursor-pointer hover:underline">
                        <ArrowRight size={12} />
                        {locationMap.get(fb.locationId) ?? fb.locationId}
                      </span>
                    ) : (
                      <span className="text-sm text-red-400">未关联点位</span>
                    )}
                  </div>

                  {fb.status !== '已关闭' && (
                    <div className="flex items-center gap-2">
                      {fb.status === '待处理' && (
                        <button
                          onClick={() => handleStatusUpdate(fb.id, '已回复')}
                          className="inline-flex items-center gap-1 rounded-md bg-teal-600/20 px-2.5 py-1 text-xs font-medium text-teal-400 hover:bg-teal-600/30 transition"
                        >
                          <Check size={12} />
                          标为已回复
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusUpdate(fb.id, '已关闭')}
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-600/20 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-600/30 transition"
                      >
                        <X size={12} />
                        标为已关闭
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === '方案版本' && (
          <div className="p-6 space-y-6">
            {sortedPlans.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <GitBranch size={40} className="mb-3 opacity-30" />
                <p className="text-sm">暂无方案版本</p>
              </div>
            )}

            {sortedPlans.length > 0 && (
              <>
                <div className="overflow-x-auto pb-4">
                  <div className="flex items-start gap-0 min-w-max">
                    {sortedPlans.map((plan, idx) => {
                      const isExpanded = expandedPlanId === plan.id
                      return (
                        <div key={plan.id} className="flex items-start">
                          {idx > 0 && (
                            <div className="flex items-center h-14 px-0">
                              <div className="w-8 h-px bg-zinc-700" />
                            </div>
                          )}
                          <div className="flex flex-col items-center">
                            <button
                              onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                              className={cn(
                                'flex flex-col items-center rounded-lg border px-4 py-2 transition min-w-[140px]',
                                isExpanded
                                  ? 'border-teal-600 bg-teal-600/10'
                                  : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600'
                              )}
                            >
                              <span className={cn('text-sm font-medium', isExpanded ? 'text-teal-400' : 'text-zinc-200')}>
                                {plan.versionName}
                              </span>
                              <span className="text-xs text-zinc-500 mt-0.5">{formatDateTime(plan.createdAt)}</span>
                              {plan.description && (
                                <span className="text-xs text-zinc-500 mt-0.5 truncate max-w-[120px]">{plan.description}</span>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {expandedPlanId && (() => {
                  const plan = sortedPlans.find((p) => p.id === expandedPlanId)
                  if (!plan) return null
                  const planLocs = getLocationsByPlanId(plan.id)
                  return (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
                      <h3 className="text-sm font-medium text-zinc-200">{plan.versionName} — 点位列表</h3>
                      {planLocs.length === 0 && (
                        <p className="text-xs text-zinc-500">该方案暂无点位</p>
                      )}
                      {planLocs.map((pl) => (
                        <div
                          key={pl.id}
                          className="flex items-center gap-3 rounded-md bg-zinc-800/50 px-3 py-2"
                        >
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', ACTION_BADGE[pl.action])}>
                            {pl.action}
                          </span>
                          <span className="text-sm text-zinc-200 flex-1">
                            {locationMap.get(pl.locationId) ?? pl.locationId}
                          </span>
                          {pl.note && (
                            <span className="text-xs text-zinc-500 truncate max-w-[200px]">{pl.note}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {sortedPlans.length >= 2 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-zinc-200">版本对比</h3>
                      <div className="flex-1" />
                      <select
                        value={diffVersionA}
                        onChange={(e) => { setDiffVersionA(e.target.value); setShowDiff(false) }}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
                      >
                        <option value="">选择版本 A</option>
                        {sortedPlans.map((p) => (
                          <option key={p.id} value={p.id}>{p.versionName}</option>
                        ))}
                      </select>
                      <ArrowRight size={14} className="text-zinc-500 flex-shrink-0" />
                      <select
                        value={diffVersionB}
                        onChange={(e) => { setDiffVersionB(e.target.value); setShowDiff(false) }}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
                      >
                        <option value="">选择版本 B</option>
                        {sortedPlans.map((p) => (
                          <option key={p.id} value={p.id}>{p.versionName}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowDiff(true)}
                        disabled={!diffVersionA || !diffVersionB}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-xs font-medium transition',
                          diffVersionA && diffVersionB
                            ? 'bg-teal-600 text-white hover:bg-teal-500'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        )}
                      >
                        对比
                      </button>
                    </div>

                    {showDiff && diffResult && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-zinc-400">
                            {sortedPlans.find((p) => p.id === diffVersionA)?.versionName ?? '版本 A'}
                          </h4>
                          {(() => {
                            const locsA = getLocationsByPlanId(diffVersionA)
                            if (locsA.length === 0) return <p className="text-xs text-zinc-500">无点位</p>
                            return locsA.map((pl) => {
                              let bg = ''
                              if (diffResult.removed.includes(pl.locationId)) bg = 'bg-red-500/10 border-red-500/30'
                              else if (diffResult.modified.includes(pl.locationId)) bg = 'bg-amber-500/10 border-amber-500/30'
                              else if (diffResult.unchanged.includes(pl.locationId)) bg = 'bg-zinc-800/50 border-transparent'
                              return (
                                <div
                                  key={pl.id}
                                  className={cn('flex items-center gap-2 rounded-md border px-3 py-2', bg)}
                                >
                                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', ACTION_BADGE[pl.action])}>
                                    {pl.action}
                                  </span>
                                  <span className="text-sm text-zinc-200 flex-1">
                                    {locationMap.get(pl.locationId) ?? pl.locationId}
                                  </span>
                                  {pl.note && (
                                    <span className="text-xs text-zinc-500 truncate max-w-[150px]">{pl.note}</span>
                                  )}
                                </div>
                              )
                            })
                          })()}
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-zinc-400">
                            {sortedPlans.find((p) => p.id === diffVersionB)?.versionName ?? '版本 B'}
                          </h4>
                          {(() => {
                            const locsB = getLocationsByPlanId(diffVersionB)
                            if (locsB.length === 0) return <p className="text-xs text-zinc-500">无点位</p>
                            return locsB.map((pl) => {
                              let bg = ''
                              if (diffResult.added.includes(pl.locationId)) bg = 'bg-emerald-500/10 border-emerald-500/30'
                              else if (diffResult.modified.includes(pl.locationId)) bg = 'bg-amber-500/10 border-amber-500/30'
                              else if (diffResult.unchanged.includes(pl.locationId)) bg = 'bg-zinc-800/50 border-transparent'
                              return (
                                <div
                                  key={pl.id}
                                  className={cn('flex items-center gap-2 rounded-md border px-3 py-2', bg)}
                                >
                                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', ACTION_BADGE[pl.action])}>
                                    {pl.action}
                                  </span>
                                  <span className="text-sm text-zinc-200 flex-1">
                                    {locationMap.get(pl.locationId) ?? pl.locationId}
                                  </span>
                                  {pl.note && (
                                    <span className="text-xs text-zinc-500 truncate max-w-[150px]">{pl.note}</span>
                                  )}
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    )}

                    {showDiff && diffResult && (diffResult.added.length > 0 || diffResult.removed.length > 0 || diffResult.modified.length > 0) && (
                      <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40" /> 新增</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500/40" /> 移除</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" /> 修改</span>
                        <span className="ml-auto">
                          +{diffResult.added.length} / -{diffResult.removed.length} / ~{diffResult.modified.length}
                        </span>
                      </div>
                    )}

                    {showDiff && diffResult && diffResult.modified.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-amber-400">变更明细</h4>
                        {diffResult.modified.map((locId) => {
                          const inA = diffResult.mapA.get(locId)!
                          const inB = diffResult.mapB.get(locId)!
                          const name = locationMap.get(locId) ?? locId
                          return (
                            <div key={locId} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 space-y-1">
                              <span className="text-sm text-zinc-200 font-medium">{name}</span>
                              {inA.action !== inB.action && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-zinc-400">操作:</span>
                                  <span className={cn('rounded-full px-2 py-0.5', ACTION_BADGE[inA.action])}>{inA.action}</span>
                                  <ChevronRight size={10} className="text-zinc-500" />
                                  <span className={cn('rounded-full px-2 py-0.5', ACTION_BADGE[inB.action])}>{inB.action}</span>
                                </div>
                              )}
                              {inA.note !== inB.note && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-zinc-400">备注:</span>
                                  <span className="text-zinc-400 line-through">{inA.note || '—'}</span>
                                  <ChevronRight size={10} className="text-zinc-500" />
                                  <span className="text-zinc-200">{inB.note || '—'}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
