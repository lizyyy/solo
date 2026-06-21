import { useEffect, useState, useCallback } from 'react'
import { GitMerge } from 'lucide-react'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { fetchMergeGroups, updateMergeGroup } from '@/api'

const strategyOptions = [
  { value: 'merge', label: '合并' },
  { value: 'separate', label: '分开' },
  { value: 'pending', label: '待定' },
]

const typeLabels: Record<string, string> = {
  same_name: '同名路口',
  duplicate_complaint: '重复投诉',
}

const sourceLabels: Record<string, string> = {
  sunlight: '实测',
  ledger: '台账',
}

export default function MergePage() {
  const { currentProjectId, ready, noProject } = useEnsureProject()
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGroups = useCallback(async () => {
    if (!currentProjectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMergeGroups(currentProjectId)
      setGroups(data)
    } catch (e: any) {
      setError(e?.message || '加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }, [currentProjectId])

  useEffect(() => {
    if (currentProjectId) loadGroups()
  }, [currentProjectId, loadGroups])

  async function handleStrategyChange(groupId: string, strategy: string) {
    try {
      await updateMergeGroup(currentProjectId!, groupId, strategy)
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, strategy } : g))
      )
    } catch {
      // ignore
    }
  }

  async function handleNoteChange(groupId: string, note: string) {
    try {
      await updateMergeGroup(currentProjectId!, groupId, undefined, note)
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, note } : g))
      )
    } catch {
      // ignore
    }
  }

  if (!ready || loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
  }

  if (noProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <GitMerge className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400">暂无项目，请先到工作台创建或导入项目</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-rose-500 text-sm">{error}</p>
        <button
          onClick={loadGroups}
          className="text-sm px-4 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-900"
        >
          重新加载
        </button>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <GitMerge className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400">暂无归并分组，请先导入数据</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <h2
        className="text-2xl font-bold text-slate-800 mb-6"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        归并去重
      </h2>

      <div className="space-y-4">
        {groups.map((group) => {
          const records: any[] = group.records || []

          return (
            <div
              key={group.id}
              className="bg-white rounded-lg border border-slate-200 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-teal-100 text-teal-700">
                    {typeLabels[group.type] || group.type}
                  </span>
                  <span className="text-sm text-slate-500">
                    {records.length} 条记录
                  </span>
                </div>
                <select
                  value={group.strategy}
                  onChange={(e) => handleStrategyChange(group.id, e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-700/30"
                >
                  {strategyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 mb-3">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start gap-3 text-sm bg-slate-50 rounded-md px-3 py-2"
                  >
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white border border-slate-200 text-slate-500 flex-shrink-0">
                      {sourceLabels[rec.source] || rec.source}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-700">{rec.address}</span>
                      <span className="text-slate-400 mx-2">|</span>
                      <span className="text-slate-600">{rec.period}</span>
                      <span className="text-slate-400 mx-2">|</span>
                      <span className="text-slate-600">日照{rec.sunlight_hours ?? '缺失'}h</span>
                      {rec.complaint && (
                        <>
                          <span className="text-slate-400 mx-2">|</span>
                          <span className="text-amber-600">投诉: {rec.complaint}</span>
                        </>
                      )}
                    </div>
                    <span className="text-slate-400 text-xs font-mono flex-shrink-0">
                      {rec.longitude?.toFixed(4)}, {rec.latitude?.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>

              {records.some((r: any) => r.raw_remark) && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700 mb-1">原始备注</p>
                  {records.filter((r: any) => r.raw_remark).map((r: any) => (
                    <p key={r.id} className="text-xs text-amber-800 font-mono">{r.raw_remark}</p>
                  ))}
                </div>
              )}

              <textarea
                value={group.note || ''}
                onChange={(e) => handleNoteChange(group.id, e.target.value)}
                placeholder="添加归并备注..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-700/30"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
