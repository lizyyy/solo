import { useState, useEffect } from 'react'
import { ProblemVersion, VersionDiff } from '../types'
import { problemApi } from '../services/api'
import { ChevronDown, ChevronUp, GitCompare, ArrowRight } from 'lucide-react'

interface VersionDiffViewerProps {
  problemId: string
  versions: ProblemVersion[]
}

export default function VersionDiffViewer({ problemId, versions }: VersionDiffViewerProps) {
  const [v1, setV1] = useState<number>(1)
  const [v2, setV2] = useState<number>(versions.length > 0 ? versions[0].version : 1)
  const [diff, setDiff] = useState<VersionDiff[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const sortedVersions = [...versions].sort((a, b) => a.version - b.version)

  useEffect(() => {
    if (sortedVersions.length >= 2) {
      setV1(sortedVersions[0].version)
      setV2(sortedVersions[sortedVersions.length - 1].version)
    }
  }, [versions])

  useEffect(() => {
    if (v1 && v2 && v1 !== v2) {
      loadDiff()
    }
  }, [v1, v2, problemId])

  const loadDiff = async () => {
    setLoading(true)
    try {
      const data = await problemApi.compareVersions(problemId, v1, v2)
      setDiff(data)
    } catch (error) {
      console.error('Failed to load version diff:', error)
    } finally {
      setLoading(false)
    }
  }

  const fieldLabels: Record<string, string> = {
    musicianName: '乐手姓名',
    channel: '监听通道',
    description: '问题描述',
    tuningAction: '调音动作',
    tuningParams: '调音参数',
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  if (sortedVersions.length < 2) {
    return (
      <div className="card">
        <p className="text-slate-400 text-sm text-center py-4">
          版本不足，无法对比
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-accent-amber" />
          <h3 className="font-display text-sm font-bold text-white">版本对比</h3>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <label className="label">旧版本</label>
              <select
                value={v1}
                onChange={(e) => setV1(parseInt(e.target.value))}
                className="input"
              >
                {sortedVersions.map((v) => (
                  <option key={v.version} value={v.version}>
                    V{v.version} - {v.operatorName}
                  </option>
                ))}
              </select>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500 mt-5" />
            <div className="flex-1">
              <label className="label">新版本</label>
              <select
                value={v2}
                onChange={(e) => setV2(parseInt(e.target.value))}
                className="input"
              >
                {sortedVersions.map((v) => (
                  <option key={v.version} value={v.version}>
                    V{v.version} - {v.operatorName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-stage-blue rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {diff.filter(d => d.changed).length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">
                  两个版本无差异
                </p>
              ) : (
                diff.filter(d => d.changed).map((d) => (
                  <div key={d.field} className="bg-stage-darker rounded overflow-hidden">
                    <div className="px-3 py-2 bg-stage-blue/50 border-b border-stage-border">
                      <span className="text-sm font-medium text-white">
                        {fieldLabels[d.field] || d.field}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-stage-border">
                      <div className="p-3">
                        <div className="text-xs text-accent-red mb-1 font-medium">旧值</div>
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                          {formatValue(d.oldValue)}
                        </pre>
                      </div>
                      <div className="p-3">
                        <div className="text-xs text-accent-green mb-1 font-medium">新值</div>
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                          {formatValue(d.newValue)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
