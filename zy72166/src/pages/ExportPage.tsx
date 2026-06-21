import { useEffect, useState, useCallback } from 'react'
import { FileOutput, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useProjectStore } from '@/store'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { fetchExport, generateExport, downloadCsv } from '@/api'

const categoryConfig: Record<string, { label: string; headerCls: string; badgeCls: string }> = {
  processed: {
    label: '已处理',
    headerCls: 'bg-emerald-50 border-emerald-200',
    badgeCls: 'bg-emerald-100 text-emerald-600',
  },
  pending_verification: {
    label: '待核实',
    headerCls: 'bg-amber-50 border-amber-200',
    badgeCls: 'bg-amber-100 text-amber-600',
  },
  needs_field_visit: {
    label: '需现场复看',
    headerCls: 'bg-rose-50 border-rose-200',
    badgeCls: 'bg-rose-100 text-rose-600',
  },
}

export default function ExportPage() {
  const { currentProjectId, setCurrentProjectId, operator } = useProjectStore()
  const { ready, noProject } = useEnsureProject()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    processed: true,
    pending_verification: true,
    needs_field_visit: true,
  })

  const loadExport = useCallback(async (projectId = currentProjectId) => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchExport(projectId)
      setData(result)
    } catch (e: any) {
      setError(e?.message || '加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }, [currentProjectId])

  useEffect(() => {
    if (currentProjectId) loadExport(currentProjectId)
  }, [currentProjectId, loadExport])

  async function handleGenerate() {
    if (!currentProjectId || !operator) return
    setGenerating(true)
    try {
      await generateExport(currentProjectId, operator)
      await loadExport(currentProjectId)
    } catch {
      // ignore
    } finally {
      setGenerating(false)
    }
  }

  function toggleSection(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (!ready || loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
  }

  if (noProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <FileOutput className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400">暂无项目，请先到工作台创建或导入项目</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-rose-500 text-sm">{error}</p>
        <button
          onClick={() => currentProjectId && loadExport(currentProjectId)}
          className="text-sm px-4 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-900"
        >
          重新加载
        </button>
      </div>
    )
  }

  const hasData = data && (data.processed?.length > 0 || data.pending_verification?.length > 0 || data.needs_field_visit?.length > 0)

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold text-slate-800"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          公示清单
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || !operator}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 text-white text-sm rounded-lg font-medium hover:bg-teal-800 disabled:opacity-50 transition-colors"
          >
            <FileOutput className="w-4 h-4" />
            {generating ? '生成中...' : '生成公示清单'}
          </button>
          {hasData && (
            <button
              onClick={() => downloadCsv(currentProjectId!)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 text-sm rounded-lg font-medium border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
          )}
        </div>
      </div>

      {!hasData && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400">
          暂无公示数据，请先完成复核后点击"生成公示清单"
        </div>
      )}

      {hasData && (
        <div className="space-y-4">
          {(['processed', 'pending_verification', 'needs_field_visit'] as const).map((key) => {
            const items = data[key] || []
            if (items.length === 0) return null
            const config = categoryConfig[key]

            return (
              <div key={key} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleSection(key)}
                  className={`w-full flex items-center justify-between px-5 py-3 border ${config.headerCls}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{config.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badgeCls}`}>
                      {items.length}
                    </span>
                  </div>
                  {expanded[key] ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {expanded[key] && (
                  <div className="bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">点位名称</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">地址</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">日照时长</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">判定依据</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">操作人</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">复核时间</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium">交接备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any) => (
                          <tr key={item.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-4 py-2.5 text-slate-700">{item.location_name}</td>
                            <td className="px-4 py-2.5 text-slate-700">{item.address}</td>
                            <td className="px-4 py-2.5 text-slate-700">{item.sunlight_hours ?? '—'}</td>
                            <td className="px-4 py-2.5 text-slate-700">{item.judgment_basis}</td>
                            <td className="px-4 py-2.5 text-slate-700">{item.operator}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{item.reviewed_at}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[150px] truncate">
                              {item.handover_note || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
