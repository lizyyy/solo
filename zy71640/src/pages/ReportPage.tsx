import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExhibitionStore } from '@/store/useExhibitionStore'
import { CONFLICT_TYPE_LABELS, VALIDATION_STATUS_CONFIG } from '@/types'
import type { ConflictType } from '@/types'
import { ArrowLeft, Download, FileJson, FileText, AlertTriangle, AlertCircle, Info, Check } from 'lucide-react'

export function ReportPage() {
  const navigate = useNavigate()
  const conflicts = useExhibitionStore((s) => s.conflicts)
  const artworks = useExhibitionStore((s) => s.artworks)
  const lights = useExhibitionStore((s) => s.lights)
  const paths = useExhibitionStore((s) => s.paths)
  const sources = useExhibitionStore((s) => s.sources)
  const resolveConflict = useExhibitionStore((s) => s.resolveConflict)
  const [exportFormat, setExportFormat] = useState<'json' | 'html'>('json')

  const unresolved = conflicts.filter((c) => !c.resolvedAt)
  const resolved = conflicts.filter((c) => c.resolvedAt)
  const severityIcon = (s: string) => {
    if (s === 'critical') return <AlertTriangle className="w-4 h-4 text-red-400" />
    if (s === 'warning') return <AlertCircle className="w-4 h-4 text-amber-400" />
    return <Info className="w-4 h-4 text-blue-400" />
  }

  const groupedByType = (list: typeof conflicts) => {
    const groups: Record<string, typeof conflicts> = {}
    list.forEach((c) => {
      if (!groups[c.type]) groups[c.type] = []
      groups[c.type].push(c)
    })
    return groups
  }

  const getObjectName = (id: string) => {
    const a = artworks.find((x) => x.id === id)
    if (a) return a.title
    const l = lights.find((x) => x.id === id)
    if (l) return `灯光 ${l.id}`
    const p = paths.find((x) => x.id === id)
    if (p) return p.name
    return id
  }

  const getSourceLabel = (sourceId: string | undefined) => {
    if (!sourceId) return ''
    const s = sources.find((x) => x.id === sourceId)
    return s ? s.label : sourceId
  }

  const exportReport = useCallback(() => {
    const reportData = {
      exportTime: new Date().toISOString(),
      summary: {
        total: conflicts.length,
        unresolved: unresolved.length,
        resolved: resolved.length,
        byType: Object.fromEntries(
          Object.entries(groupedByType(conflicts)).map(([k, v]) => [CONFLICT_TYPE_LABELS[k as ConflictType] || k, v.length])
        ),
      },
      conflicts: conflicts.map((c) => ({
        ...c,
        affectedNames: c.affectedIds.map(getObjectName),
      })),
      artworks: artworks.map((a) => ({
        ...a,
        sourceLabel: getSourceLabel(a.sourceId),
        validationLabel: VALIDATION_STATUS_CONFIG[a.validationStatus].label,
      })),
      lights: lights.map((l) => ({
        ...l,
        sourceLabel: getSourceLabel(l.sourceId),
        validationLabel: VALIDATION_STATUS_CONFIG[l.validationStatus].label,
      })),
    }

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `布展报告_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const html = generateHtmlReport(reportData)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `布展报告_${new Date().toISOString().slice(0, 10)}.html`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [conflicts, artworks, lights, exportFormat])

  const unresolvedGroups = groupedByType(unresolved)
  const resolvedGroups = groupedByType(resolved)

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-zinc-200 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display text-2xl font-semibold">冲突报告</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setExportFormat('json')}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                  exportFormat === 'json' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-500'
                }`}
              >
                <FileJson className="w-3 h-3" /> JSON
              </button>
              <button
                onClick={() => setExportFormat('html')}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                  exportFormat === 'html' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-500'
                }`}
              >
                <FileText className="w-3 h-3" /> HTML
              </button>
            </div>
            <button
              onClick={exportReport}
              className="px-4 py-1.5 text-sm rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> 导出报告
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#16213e] rounded-xl p-5 border border-zinc-700/30">
            <div className="text-3xl font-mono font-bold text-red-400">{unresolved.length}</div>
            <div className="text-sm text-zinc-500 mt-1">未解决冲突</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-5 border border-zinc-700/30">
            <div className="text-3xl font-mono font-bold text-amber-400">{resolved.length}</div>
            <div className="text-sm text-zinc-500 mt-1">已解决</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-5 border border-zinc-700/30">
            <div className="text-3xl font-mono font-bold text-zinc-300">{conflicts.length}</div>
            <div className="text-sm text-zinc-500 mt-1">冲突总计</div>
          </div>
        </div>

        {Object.keys(unresolvedGroups).length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              未解决冲突
            </h2>
            {Object.entries(unresolvedGroups).map(([type, items]) => (
              <ConflictGroup
                key={type}
                type={type as ConflictType}
                items={items}
                getObjectName={getObjectName}
                severityIcon={severityIcon}
                onResolve={resolveConflict}
              />
            ))}
          </section>
        )}

        {Object.keys(resolvedGroups).length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2 text-zinc-500">
              <Check className="w-5 h-5 text-emerald-400" />
              已解决
            </h2>
            {Object.entries(resolvedGroups).map(([type, items]) => (
              <ConflictGroup
                key={type}
                type={type as ConflictType}
                items={items}
                getObjectName={getObjectName}
                severityIcon={severityIcon}
                onResolve={resolveConflict}
                isResolved
              />
            ))}
          </section>
        )}

        {conflicts.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            暂无冲突记录
          </div>
        )}
      </div>
    </div>
  )
}

function ConflictGroup({
  type,
  items,
  getObjectName,
  severityIcon,
  onResolve,
  isResolved = false,
}: {
  type: ConflictType
  items: ReturnType<typeof useExhibitionStore.getState>['conflicts']
  getObjectName: (id: string) => string
  severityIcon: (s: string) => React.ReactNode
  onResolve: (id: string) => void
  isResolved?: boolean
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{
          backgroundColor: type === 'overlap' ? '#ef4444' :
            type === 'light_obstruction' ? '#f59e0b' :
            type === 'path_backflow' ? '#8b5cf6' : '#06b6d4'
        }} />
        {CONFLICT_TYPE_LABELS[type]} ({items.length})
      </h3>
      <div className="space-y-2">
        {items.map((c) => (
          <div
            key={c.id}
            className={`bg-[#16213e] rounded-lg p-4 border border-zinc-700/30 ${isResolved ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {severityIcon(c.severity)}
                <div>
                  <div className="text-sm text-zinc-200">{c.description}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.affectedIds.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800/80 text-zinc-400"
                      >
                        {getObjectName(id)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {!isResolved && (
                <button
                  onClick={() => onResolve(c.id)}
                  className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3 h-3" /> 标记解决
                </button>
              )}
              {isResolved && c.resolvedAt && (
                <span className="text-xs text-zinc-600 shrink-0">
                  {new Date(c.resolvedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function generateHtmlReport(data: Record<string, unknown>): string {
  const summary = data.summary as Record<string, unknown>
  const conflicts = data.conflicts as Record<string, unknown>[]
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>布展报告</title>
<style>
  body{font-family:'DM Sans',sans-serif;background:#0f0f1a;color:#e4e4e7;max-width:800px;margin:0 auto;padding:40px 20px}
  h1{font-family:'Playfair Display',serif;font-size:28px;margin-bottom:8px}
  h2{font-size:18px;color:#a1a1aa;margin-top:32px}
  .card{background:#16213e;border:1px solid #3f3f46;border-radius:12px;padding:16px;margin:8px 0}
  .stat{display:flex;gap:16px;margin:20px 0}
  .stat div{flex:1;text-align:center;padding:16px;background:#16213e;border-radius:12px;border:1px solid #3f3f46}
  .stat .num{font-size:28px;font-weight:bold;font-family:'JetBrains Mono',monospace}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;margin:2px}
  .critical{color:#f87171;background:#991b1b40}.warning{color:#fbbf24;background:#92400e40}.info{color:#60a5fa;background:#1e3a5f40}
  pre{background:#0f0f1a;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px}
</style></head>
<body>
<h1>布展冲突报告</h1>
<p style="color:#71717a">导出时间: ${new Date().toLocaleString('zh-CN')}</p>
<div class="stat">
  <div><div class="num" style="color:#f87171">${summary.total}</div>冲突总计</div>
  <div><div class="num" style="color:#fbbf24">${summary.unresolved}</div>未解决</div>
  <div><div class="num" style="color:#34d399">${summary.resolved}</div>已解决</div>
</div>
<h2>冲突明细</h2>
${conflicts.map((c) => `<div class="card"><span class="badge ${c.severity}">${c.severity}</span> <span style="color:#e4e4e7">${c.description}</span><br><small style="color:#71717a">影响: ${(c.affectedNames as string[]).join(', ')}</small></div>`).join('\n')}
</body></html>`
}
