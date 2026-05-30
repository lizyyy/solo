import { useState, useEffect } from 'react'
import { Clock, ChevronDown, ChevronUp, FileDown, GitBranch } from 'lucide-react'
import * as api from '@/lib/api'
import { useStore } from '@/store/useStore'
import { formatWeight, getSchemeStatusColor, statusLabel } from '@/lib/helpers'
import type { SchemeVersion, ChangelogEntry, SchemeDetail } from '../../shared/types'

interface VersionFull {
  version: SchemeVersion
  changelog: ChangelogEntry[]
  data: SchemeDetail
}

export default function History() {
  const { currentSchemeId, schemeDetail } = useStore()
  const [versions, setVersions] = useState<SchemeVersion[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [versionData, setVersionData] = useState<Map<string, VersionFull>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentSchemeId) {
      setVersions([])
      setExpandedId(null)
      setVersionData(new Map())
      return
    }
    setLoading(true)
    api.getVersions(currentSchemeId)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [currentSchemeId])

  const handleExpand = async (versionId: string) => {
    if (expandedId === versionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(versionId)
    if (!currentSchemeId || versionData.has(versionId)) return
    try {
      const full = await api.getVersion(currentSchemeId, versionId)
      setVersionData((prev) => {
        const next = new Map(prev)
        next.set(versionId, full)
        return next
      })
    } catch {
      // ignore
    }
  }

  const handleExport = async () => {
    if (!currentSchemeId) return
    try {
      const { filename } = await api.generateReport(currentSchemeId)
      window.open(`/api/reports/download/${filename}`, '_blank')
    } catch {
      // ignore
    }
  }

  if (!currentSchemeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-400">
        <GitBranch className="w-10 h-10 text-zinc-600" />
        <p className="text-lg">请先选择一个方案查看历史版本</p>
      </div>
    )
  }

  const currentExpanded = expandedId ? versionData.get(expandedId) : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-brand-accent" />
          {schemeDetail?.scheme.name ?? '方案'} - 版本历史
        </h2>
        <button className="btn-primary flex items-center gap-2" onClick={handleExport}>
          <FileDown className="w-4 h-4" />
          导出当前报告
        </button>
      </div>

      {loading && <p className="text-zinc-400 text-sm">加载中...</p>}

      {!loading && versions.length === 0 && (
        <p className="text-zinc-500 text-sm">暂无版本记录</p>
      )}

      <div className="relative ml-4">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-700" />
        <div className="space-y-4">
          {versions.map((v) => {
            const isExpanded = expandedId === v.id
            const full = versionData.get(v.id)
            return (
              <div key={v.id}>
                <div className="flex items-start gap-4 relative">
                  <div className="w-4 h-4 rounded-full bg-brand-accent border-2 border-brand-dark mt-1 relative z-10 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-brand-accent">v{v.versionNumber}</span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(v.createdAt).toLocaleString('zh-CN')}
                      </span>
                      <button
                        className="btn-ghost p-1"
                        onClick={() => handleExpand(v.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {isExpanded && full && (
                      <div className="mt-3 card space-y-2">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          <span className="text-zinc-400">方案名称</span>
                          <span className="text-zinc-200">{full.data.scheme.name}</span>
                          <span className="text-zinc-400">吊点数量</span>
                          <span className="text-zinc-200 font-mono">{full.data.points.length}</span>
                          <span className="text-zinc-400">总载荷</span>
                          <span className="text-zinc-200 font-mono">
                            {full.data.points.reduce((s, p) => s + p.ratedLoad, 0).toFixed(1)} kg
                          </span>
                          <span className="text-zinc-400">状态</span>
                          <span className={getSchemeStatusColor(full.data.scheme.status)}>
                            {statusLabel(full.data.scheme.status)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {currentExpanded && currentExpanded.changelog.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">变更记录 (v{currentExpanded.version.versionNumber})</h3>
          <div className="space-y-2">
            {currentExpanded.changelog.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <span className="text-zinc-500 font-mono text-xs shrink-0">
                  {new Date(c.changedAt).toLocaleString('zh-CN')}
                </span>
                <span className="text-brand-accent font-medium">{c.field}</span>
                <span className="text-red-400 line-through font-mono text-xs">{c.oldValue}</span>
                <span className="text-zinc-500">→</span>
                <span className="text-green-400 font-mono text-xs">{c.newValue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
