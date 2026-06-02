import { useEffect, useState } from 'react'
import { Upload, RefreshCw } from 'lucide-react'
import { useProjectStore } from '@/store'
import { fetchProjects, fetchPrecheck, seedData } from '@/api'
import { parseJsonField } from '@/lib/utils'

const typeTranslations: Record<string, string> = {
  same_name: '同名路口',
  duplicate_complaint: '重复投诉',
  coordinate_drift: '坐标偏移',
  cross_period: '跨时段统计',
  field_missing: '字段缺失',
}

const severityConfig: Record<string, { label: string; cls: string }> = {
  error: { label: '严重', cls: 'bg-rose-100 text-rose-600' },
  warning: { label: '警告', cls: 'bg-amber-100 text-amber-600' },
  info: { label: '信息', cls: 'bg-blue-100 text-blue-600' },
}

export default function ImportPage() {
  const { currentProjectId, setCurrentProjectId } = useProjectStore()
  const [projects, setProjects] = useState<any[]>([])
  const [warnings, setWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (currentProjectId) loadPrecheck()
  }, [currentProjectId])

  async function loadProjects() {
    try {
      const list = await fetchProjects()
      setProjects(list)
      if (!currentProjectId && list.length > 0) {
        setCurrentProjectId(list[0].id)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function loadPrecheck() {
    try {
      const w = await fetchPrecheck(currentProjectId!)
      setWarnings(w)
    } catch {
      // ignore
    }
  }

  async function handleSeed() {
    if (!currentProjectId) return
    setSeeding(true)
    try {
      await seedData(currentProjectId)
      await loadPrecheck()
    } catch {
      // ignore
    } finally {
      setSeeding(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
  }

  return (
    <div className="p-8 max-w-5xl">
      <h2
        className="text-2xl font-bold text-slate-800 mb-6"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        数据导入
      </h2>

      {projects.length > 1 && (
        <div className="mb-4">
          <select
            value={currentProjectId || ''}
            onChange={(e) => setCurrentProjectId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-700/30"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-8 mb-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
            <Upload className="w-7 h-7 text-teal-700" />
          </div>
          <p className="text-sm text-slate-500">拖拽文件到此处上传，或点击下方按钮加载示范数据</p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? '加载中...' : '加载示范数据'}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">
            预检结果（{warnings.length} 条）
          </h3>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">严重程度</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">异常类型</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">描述</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">原始值</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => {
                  const sev = severityConfig[w.severity] || severityConfig.info
                  const originalValues = parseJsonField<Record<string, string>>(
                    w.original_values,
                    {}
                  )
                  return (
                    <tr key={w.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.cls}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {typeTranslations[w.type] || w.type}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{w.description}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                        {Object.entries(originalValues)
                          .map(([k, v]) => v)
                          .join('；')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && warnings.length === 0 && currentProjectId && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400">
          暂无预检结果，请先导入数据
        </div>
      )}
    </div>
  )
}
