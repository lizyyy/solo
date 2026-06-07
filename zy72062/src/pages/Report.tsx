import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { AnomalyType, AnomalyStatus } from '@/types'
import {
  Building2,
  Link2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FilePlus2,
  Download,
  ChevronDown,
  ChevronRight,
  FileSearch,
  History,
} from 'lucide-react'

const TYPE_CONFIG: Record<AnomalyType, { label: string; color: string; bg: string }> = {
  coordinate_offset: { label: '坐标偏移', color: 'text-[#3ec9c2]', bg: 'bg-[#3ec9c2]/15' },
  duplicate_name: { label: '名称重复', color: 'text-orange-400', bg: 'bg-orange-400/15' },
  missing_photo: { label: '缺失照片', color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  cross_floor: { label: '跨层异常', color: 'text-purple-400', bg: 'bg-purple-400/15' },
}

const STATUS_CONFIG: Record<AnomalyStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  confirmed: { label: '已确认', color: 'text-green-400', bg: 'bg-green-400/15' },
  ignored: { label: '已忽略', color: 'text-gray-400', bg: 'bg-gray-400/15' },
}

const ACTION_COLORS: Record<string, string> = {
  import: 'bg-blue-500',
  edit: 'bg-green-500',
  supplement: 'bg-orange-400',
  mark_anomaly: 'bg-[#e8634f]',
  save_view: 'bg-purple-500',
  merge_entity: 'bg-[#3ec9c2]',
}

const ACTION_LABELS: Record<string, string> = {
  import: '导入',
  edit: '编辑',
  supplement: '补充',
  mark_anomaly: '异常标记',
  save_view: '保存视图',
  merge_entity: '合并实体',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function Report() {
  const entities = useStore((s) => s.entities)
  const equityLinks = useStore((s) => s.equityLinks)
  const anomalies = useStore((s) => s.anomalies)
  const supplements = useStore((s) => s.supplements)
  const operationLogs = useStore((s) => s.operationLogs)
  const updateAnomalyStatus = useStore((s) => s.updateAnomalyStatus)
  const exportData = useStore((s) => s.exportData)
  const resetData = useStore((s) => s.resetData)

  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [expandedTimeline, setExpandedTimeline] = useState(false)

  const pendingCount = anomalies.filter((a) => a.status === 'pending').length
  const confirmedCount = anomalies.filter((a) => a.status === 'confirmed').length

  const sourceMap = new Map<string, { entities: typeof entities; importTime: string }>()
  entities.forEach((e) => {
    const group = sourceMap.get(e.sourceFile)
    if (group) group.entities.push(e)
    else sourceMap.set(e.sourceFile, { entities: [e], importTime: e.importTime })
  })

  const anomalyEntityIds = new Set(anomalies.map((a) => a.entityId))
  const anomalyByEntity = new Map<string, number>()
  anomalies.forEach((a) => {
    anomalyByEntity.set(a.entityId, (anomalyByEntity.get(a.entityId) || 0) + 1)
  })

  const recentLogs = [...operationLogs].reverse().slice(0, 50)

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `审计报告_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSource = (file: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      next.has(file) ? next.delete(file) : next.add(file)
      return next
    })
  }

  const stats = [
    { label: '实体总数', value: entities.length, icon: Building2, color: 'text-[#d4a543]' },
    { label: '股权链接数', value: equityLinks.length, icon: Link2, color: 'text-[#3ec9c2]' },
    { label: '异常总数', value: anomalies.length, icon: AlertTriangle, color: 'text-[#e8634f]' },
    { label: '待处理异常', value: pendingCount, icon: Clock, color: 'text-yellow-400' },
    { label: '已确认异常', value: confirmedCount, icon: CheckCircle2, color: 'text-green-400' },
    { label: '增补记录数', value: supplements.length, icon: FilePlus2, color: 'text-[#8b95a5]' },
  ]

  return (
    <div className="min-h-screen bg-[#0f1219] text-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#d4a543]">审计报告</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (confirm('确定要重置所有数据吗？此操作不可撤销。')) resetData() }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors text-sm"
          >
            重置数据
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d4a543]/15 text-[#d4a543] hover:bg-[#d4a543]/25 transition-colors"
          >
            <Download size={16} /> 导出JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#1a1f2e] rounded-xl p-4 flex flex-col items-center gap-2">
            <s.icon size={20} className={s.color} />
            <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-[#8b95a5]">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1f2e] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[#d4a543] mb-4 flex items-center gap-2">
          <AlertTriangle size={18} /> 异常清单
        </h2>
        {anomalies.length === 0 ? (
          <p className="text-[#8b95a5] text-sm py-4 text-center">暂无异常记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8b95a5] border-b border-gray-700/50">
                  <th className="text-left py-2 px-3 font-medium">实体名称</th>
                  <th className="text-left py-2 px-3 font-medium">异常类型</th>
                  <th className="text-left py-2 px-3 font-medium">描述</th>
                  <th className="text-left py-2 px-3 font-medium">来源文件</th>
                  <th className="text-left py-2 px-3 font-medium">检测时间</th>
                  <th className="text-left py-2 px-3 font-medium">状态</th>
                  <th className="text-left py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => {
                  const entity = entities.find((e) => e.id === a.entityId)
                  const tc = TYPE_CONFIG[a.type]
                  const sc = STATUS_CONFIG[a.status]
                  return (
                    <tr key={a.id} className="border-b border-gray-700/30 hover:bg-white/[0.02]">
                      <td className="py-2 px-3">{entity?.name ?? a.entityId}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${tc.color} ${tc.bg}`}>
                          {tc.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={a.description}>
                        {a.description}
                      </td>
                      <td className="py-2 px-3 text-[#8b95a5] text-xs">{a.sourceFile}</td>
                      <td className="py-2 px-3 text-[#8b95a5] text-xs">{formatDate(a.detectedAt)}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${sc.color} ${sc.bg}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {a.status !== 'confirmed' && (
                            <button
                              onClick={() => updateAnomalyStatus(a.id, 'confirmed')}
                              className="px-2 py-0.5 text-xs rounded bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            >确认</button>
                          )}
                          {a.status !== 'ignored' && (
                            <button
                              onClick={() => updateAnomalyStatus(a.id, 'ignored')}
                              className="px-2 py-0.5 text-xs rounded bg-gray-500/15 text-gray-400 hover:bg-gray-500/25"
                            >忽略</button>
                          )}
                          {a.status !== 'pending' && (
                            <button
                              onClick={() => updateAnomalyStatus(a.id, 'pending')}
                              className="px-2 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
                            >撤回</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#1a1f2e] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[#d4a543] mb-4 flex items-center gap-2">
          <FileSearch size={18} /> 来源溯源
        </h2>
        {sourceMap.size === 0 ? (
          <p className="text-[#8b95a5] text-sm py-4 text-center">暂无数据</p>
        ) : (
          <div className="space-y-2">
            {[...sourceMap.entries()].map(([file, group]) => {
              const fileAnomalyCount = group.entities.filter((e) => anomalyEntityIds.has(e.id)).length
              const expanded = expandedSources.has(file)
              return (
                <div key={file} className="border border-gray-700/30 rounded-lg">
                  <button
                    onClick={() => toggleSource(file)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? <ChevronDown size={16} className="text-[#8b95a5]" /> : <ChevronRight size={16} className="text-[#8b95a5]" />}
                      <span className="font-medium">{file}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-[#8b95a5]">导入: {formatDate(group.importTime)}</span>
                      <span className="text-[#3ec9c2]">{group.entities.length} 实体</span>
                      {fileAnomalyCount > 0 && (
                        <span className="text-[#e8634f]">{fileAnomalyCount} 异常</span>
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 space-y-1">
                      {group.entities.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-white/[0.02]">
                          <span className={anomalyEntityIds.has(e.id) ? 'text-[#e8634f]' : ''}>
                            {e.name}
                            {anomalyByEntity.has(e.id) && (
                              <span className="ml-2 text-xs text-[#e8634f]">({anomalyByEntity.get(e.id)}条异常)</span>
                            )}
                          </span>
                          <span className="text-[#8b95a5] text-xs">处理: {formatDate(e.processTime)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-[#1a1f2e] rounded-xl p-5">
        <h2
          className="text-lg font-semibold text-[#d4a543] mb-4 flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setExpandedTimeline(!expandedTimeline)}
        >
          <History size={18} /> 操作时间线
          <span className="text-xs text-[#8b95a5] font-normal ml-2">
            共 {operationLogs.length} 条{operationLogs.length > 5 && !expandedTimeline ? '（点击展开）' : ''}
          </span>
        </h2>
        {recentLogs.length === 0 ? (
          <p className="text-[#8b95a5] text-sm py-4 text-center">暂无操作记录</p>
        ) : (
          <div className="relative ml-3">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-700/50" />
            <div className="space-y-4">
              {(expandedTimeline ? recentLogs : recentLogs.slice(0, 5)).map((log) => (
                <div key={log.id} className="relative flex gap-4 pl-6">
                  <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-500'} flex items-center justify-center`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1a1f2e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ACTION_COLORS[log.action] || 'bg-gray-500'} text-white`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="text-[#8b95a5] text-xs">{formatDate(log.timestamp)}</span>
                    </div>
                    <p className="text-sm mt-0.5 text-gray-300 truncate">{log.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
