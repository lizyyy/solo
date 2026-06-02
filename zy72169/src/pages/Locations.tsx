import { useEffect, useState, useMemo } from 'react'
import { useLocationStore } from '@/stores/locationStore'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { usePhotoStore } from '@/stores/photoStore'
import { MapPin, Search, Filter, X, Check, ChevronRight, AlertTriangle, Image, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Location, MergeStatus, LocationStatus, MergeSuggestion } from '@/types'

const MERGE_OPTIONS: { value: MergeStatus | '全部'; label: string }[] = [
  { value: '全部', label: '全部' },
  { value: '已归并', label: '已归并' },
  { value: '疑似重复', label: '疑似重复' },
  { value: '未归并', label: '未归并' },
]

const STATUS_OPTIONS: { value: LocationStatus | '全部'; label: string }[] = [
  { value: '全部', label: '全部' },
  { value: '规划中', label: '规划中' },
  { value: '施工中', label: '施工中' },
  { value: '已启用', label: '已启用' },
  { value: '暂停', label: '暂停' },
]

function statusBadgeClass(status: LocationStatus) {
  switch (status) {
    case '规划中': return 'bg-zinc-700/60 text-zinc-300 ring-1 ring-zinc-600'
    case '施工中': return 'bg-amber-900/50 text-amber-300 ring-1 ring-amber-700'
    case '已启用': return 'bg-teal-900/50 text-teal-300 ring-1 ring-teal-700'
    case '暂停': return 'bg-red-900/50 text-red-300 ring-1 ring-red-700'
  }
}

function mergeBadgeClass(mergeStatus: MergeStatus) {
  switch (mergeStatus) {
    case '已归并': return 'bg-violet-900/50 text-violet-300 ring-1 ring-violet-700'
    case '疑似重复': return 'bg-amber-900/50 text-amber-300 ring-1 ring-amber-700'
    case '未归并': return 'bg-zinc-700/60 text-zinc-300 ring-1 ring-zinc-600'
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Locations() {
  const { locations, aliases, mergeSuggestions, loadAll: loadLocations, confirmMerge, rejectMerge } = useLocationStore()
  const { loadAll: loadFeedbacks, getByLocationId } = useFeedbackStore()
  const { loadAll: loadPhotos, getByLocationId: getPhotosByLocationId } = usePhotoStore()

  const [searchText, setSearchText] = useState('')
  const [mergeFilter, setMergeFilter] = useState<MergeStatus | '全部'>('全部')
  const [statusFilter, setStatusFilter] = useState<LocationStatus | '全部'>('全部')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [activeMerge, setActiveMerge] = useState<MergeSuggestion | null>(null)

  useEffect(() => {
    loadLocations()
    loadFeedbacks()
    loadPhotos()
  }, [loadLocations, loadFeedbacks, loadPhotos])

  const unresolvedSuggestions = useMemo(
    () => mergeSuggestions.filter((s) => !s.resolved),
    [mergeSuggestions]
  )

  const filtered = useMemo(() => {
    return locations.filter((loc) => {
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!loc.originalName.toLowerCase().includes(q) && !loc.canonicalName.toLowerCase().includes(q)) {
          return false
        }
      }
      if (mergeFilter !== '全部' && loc.mergeStatus !== mergeFilter) return false
      if (statusFilter !== '全部' && loc.status !== statusFilter) return false
      return true
    })
  }, [locations, searchText, mergeFilter, statusFilter])

  const selectedAliases = useMemo(
    () => (selectedLocation ? aliases.filter((a) => a.locationId === selectedLocation.id) : []),
    [selectedLocation, aliases]
  )

  const selectedPhotos = useMemo(
    () => (selectedLocation ? getPhotosByLocationId(selectedLocation.id) : []),
    [selectedLocation, getPhotosByLocationId]
  )

  const selectedFeedbacks = useMemo(
    () => (selectedLocation ? getByLocationId(selectedLocation.id) : []),
    [selectedLocation, getByLocationId]
  )

  const mergeLocationA = useMemo(
    () => (activeMerge ? locations.find((l) => l.id === activeMerge.locationIdA) : null),
    [activeMerge, locations]
  )
  const mergeLocationB = useMemo(
    () => (activeMerge ? locations.find((l) => l.id === activeMerge.locationIdB) : null),
    [activeMerge, locations]
  )

  function handleConfirmMerge() {
    if (!activeMerge) return
    confirmMerge(activeMerge.id)
    setActiveMerge(null)
  }

  function handleRejectMerge() {
    if (!activeMerge) return
    rejectMerge(activeMerge.id)
    setActiveMerge(null)
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <MapPin size={20} className="text-teal-400 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-zinc-100 whitespace-nowrap">点位管理</h1>
          <div className="flex-1" />
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索原始写法或标准名称…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
            />
          </div>
        </header>

        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-950/80">
          <Filter size={14} className="text-zinc-500 flex-shrink-0" />
          <select
            value={mergeFilter}
            onChange={(e) => setMergeFilter(e.target.value as MergeStatus | '全部')}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
          >
            {MERGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LocationStatus | '全部')}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {unresolvedSuggestions.length > 0 && (
            <button
              onClick={() => setActiveMerge(unresolvedSuggestions[0])}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-amber-600/20 px-3 py-1.5 text-sm text-amber-300 ring-1 ring-amber-700 hover:bg-amber-600/30 transition"
            >
              <AlertTriangle size={14} />
              {unresolvedSuggestions.length} 条归并建议
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">原始写法</th>
                <th className="px-4 py-3 font-medium">标准名称</th>
                <th className="px-4 py-3 font-medium">地址</th>
                <th className="px-4 py-3 font-medium text-right">充电桩数量</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">归并状态</th>
                <th className="px-4 py-3 font-medium">来源</th>
                <th className="px-4 py-3 font-medium">例外</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((loc, i) => (
                <tr
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc)}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-zinc-800/70',
                    i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/50',
                    selectedLocation?.id === loc.id && 'ring-1 ring-inset ring-teal-600/40'
                  )}
                >
                  <td className="px-4 py-3 text-zinc-300">{loc.originalName}</td>
                  <td className="px-4 py-3 text-zinc-100 font-medium">{loc.canonicalName}</td>
                  <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">{loc.address}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-zinc-200">{loc.chargerCount}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', statusBadgeClass(loc.status))}>
                      {loc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', mergeBadgeClass(loc.mergeStatus))}>
                      {loc.mergeStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{loc.source}</td>
                  <td className="px-4 py-3">
                    {loc.isException ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle size={13} />
                        <span className="text-xs truncate max-w-[100px]" title={loc.exceptionNote}>{loc.exceptionNote}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDateTime(loc.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-zinc-600" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-600">
                    暂无匹配点位
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLocation && (
        <aside className="w-[400px] flex-shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">{selectedLocation.canonicalName}</h2>
            <button
              onClick={() => setSelectedLocation(null)}
              className="rounded-md p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">基本信息</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">原始写法</dt>
                  <dd className="text-zinc-200">{selectedLocation.originalName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">标准名称</dt>
                  <dd className="text-zinc-100 font-medium">{selectedLocation.canonicalName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">地址</dt>
                  <dd className="text-zinc-300 text-right max-w-[240px]">{selectedLocation.address}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">充电桩数量</dt>
                  <dd className="text-zinc-200 font-mono-num">{selectedLocation.chargerCount}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-zinc-500">状态</dt>
                  <dd>
                    <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', statusBadgeClass(selectedLocation.status))}>
                      {selectedLocation.status}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-zinc-500">归并状态</dt>
                  <dd>
                    <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', mergeBadgeClass(selectedLocation.mergeStatus))}>
                      {selectedLocation.mergeStatus}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">来源</dt>
                  <dd className="text-zinc-300">{selectedLocation.source}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">来源详情</dt>
                  <dd className="text-zinc-300 text-right max-w-[240px] truncate">{selectedLocation.sourceDetail}</dd>
                </div>
                {selectedLocation.isException && (
                  <div className="flex justify-between">
                    <dt className="text-amber-400">例外</dt>
                    <dd className="text-amber-300 text-right max-w-[240px]">⚠ {selectedLocation.exceptionNote}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-zinc-500">创建时间</dt>
                  <dd className="text-zinc-400">{formatDateTime(selectedLocation.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">更新时间</dt>
                  <dd className="text-zinc-400">{formatDateTime(selectedLocation.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            {selectedAliases.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">别名</h3>
                <div className="space-y-1.5">
                  {selectedAliases.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2 text-sm">
                      <span className="text-zinc-200">{a.alias}</span>
                      <span className="text-xs text-zinc-500">{a.source}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedPhotos.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Image size={12} /> 照片
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {selectedPhotos.map((p) => (
                    <div key={p.id} className="aspect-square rounded-md bg-zinc-900 overflow-hidden ring-1 ring-zinc-800">
                      <img src={p.data} alt={p.fileName} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedLocation.rawNote && (
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <StickyNote size={12} /> 原始备注
                </h3>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-zinc-900 px-3 py-2.5 text-xs text-zinc-400 ring-1 ring-zinc-800 font-mono leading-relaxed">
                  {selectedLocation.rawNote}
                </pre>
              </section>
            )}

            {selectedFeedbacks.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">反馈历史</h3>
                <div className="space-y-2">
                  {selectedFeedbacks.map((f) => (
                    <div key={f.id} className="rounded-md bg-zinc-900 px-3 py-2.5 ring-1 ring-zinc-800">
                      <p className="text-sm text-zinc-300">{f.content}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-zinc-500">{f.source}</span>
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          f.status === '待处理' && 'bg-amber-900/40 text-amber-300',
                          f.status === '已回复' && 'bg-teal-900/40 text-teal-300',
                          f.status === '已关闭' && 'bg-zinc-700/60 text-zinc-400',
                        )}>
                          {f.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-1">{formatDateTime(f.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>
      )}

      {activeMerge && mergeLocationA && mergeLocationB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[720px] rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">归并建议</h2>
              <button
                onClick={() => setActiveMerge(null)}
                className="rounded-md p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-zinc-500 mb-4">{activeMerge.reason}（相似度 {activeMerge.similarity.toFixed(2)}）</p>
              <div className="grid grid-cols-2 gap-4">
                {[mergeLocationA, mergeLocationB].map((loc, idx) => (
                  <div key={loc.id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-bold',
                        idx === 0 ? 'bg-teal-900/50 text-teal-300' : 'bg-zinc-700/60 text-zinc-400'
                      )}>
                        {idx === 0 ? '保留' : '合并'}
                      </span>
                      <span className="text-sm font-medium text-zinc-100 truncate">{loc.canonicalName}</span>
                    </div>
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">原始写法</dt>
                        <dd className="text-zinc-300">{loc.originalName}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">地址</dt>
                        <dd className="text-zinc-300 truncate max-w-[180px]">{loc.address}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">充电桩数量</dt>
                        <dd className="text-zinc-200 font-mono-num">{loc.chargerCount}</dd>
                      </div>
                      <div className="flex justify-between items-center">
                        <dt className="text-zinc-500">状态</dt>
                        <dd>
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', statusBadgeClass(loc.status))}>
                            {loc.status}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button
                onClick={handleRejectMerge}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
              >
                <X size={14} /> 拒绝
              </button>
              <button
                onClick={handleConfirmMerge}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition"
              >
                <Check size={14} /> 确认归并
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
