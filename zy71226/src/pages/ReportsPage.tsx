import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Download, FileText, ChevronRight, Trash2 } from 'lucide-react'

export default function ReportsPage() {
  const sessions = useStore(s => s.sessions)
  const deleteSession = useStore(s => s.deleteSession)
  const [selected, setSelected] = useState<string[]>([])

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selected.length === sessions.length) setSelected([])
    else setSelected(sessions.map(s => s.id))
  }

  const exportSelected = () => {
    const toExport = sessions.filter(s => selected.includes(s.id))
    const data = {
      exportedAt: new Date().toISOString(),
      count: toExport.length,
      reports: toExport.map(s => ({
        ...s,
        summary: {
          alertTypes: [...new Set(s.alerts.map(a => a.type))],
          alertCount: s.alerts.length,
          snapshotCount: s.curveSnapshots.length,
        }
      }))
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const now = new Date()
    const ts = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`
    a.href = url
    a.download = `报告批量导出-${ts}-共${toExport.length}份.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">学习报告</h1>
            <p className="text-slate-500 mt-1">管理和导出历史练习记录，便于交接和存档</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">
              {selected.length} / {sessions.length} 已选中
            </span>
            <button
              onClick={exportSelected}
              disabled={selected.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed text-navy-900 font-medium text-sm transition-colors"
            >
              <Download size={16} />
              批量导出
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-600">
                  <th className="p-4 text-left">
                    <button
                      onClick={selectAll}
                      className="w-4 h-4 rounded border border-navy-500 flex items-center justify-center text-gold-400"
                    >
                      {selected.length === sessions.length && sessions.length > 0 ? '✓' : ''}
                    </button>
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-slate-400">批次名称</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-400">日期</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-400">评分</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-400">状态</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-400">错因</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500">
                      <FileText size={32} className="mx-auto mb-3 opacity-50" />
                      暂无报告，完成一次练习后自动生成
                    </td>
                  </tr>
                ) : (
                  sessions.map(s => (
                    <tr key={s.id} className="border-b border-navy-600/50 hover:bg-navy-700/30 transition-colors">
                      <td className="p-4">
                        <button
                          onClick={() => toggleSelect(s.id)}
                          className="w-4 h-4 rounded border border-navy-500 flex items-center justify-center text-gold-400"
                        >
                          {selected.includes(s.id) ? '✓' : ''}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{s.batchName}</div>
                        <div className="text-xs text-slate-500 font-mono">ID: {s.id.slice(0, 8)}</div>
                      </td>
                      <td className="p-4 text-sm text-slate-400">{s.batchDate}</td>
                      <td className="p-4">
                        <span className={`font-mono text-lg font-semibold ${
                          s.durationScore >= 80 ? 'text-emerald-400' :
                          s.durationScore >= 50 ? 'text-gold-400' : 'text-red-400'
                        }`}>
                          {s.durationScore}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">分</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          s.completedAt
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {s.completedAt ? '已完成' : '进行中'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1.5">
                          {s.alerts.filter(a => a.type === 'inversion').length > 0 && (
                            <span className="w-3 h-3 rounded-full bg-red-500" title={`倒挂 ${s.alerts.filter(a => a.type === 'inversion').length}次`} />
                          )}
                          {s.alerts.filter(a => a.type === 'duration_mismatch').length > 0 && (
                            <span className="w-3 h-3 rounded-full bg-orange-500" title={`错配 ${s.alerts.filter(a => a.type === 'duration_mismatch').length}次`} />
                          )}
                          {s.alerts.filter(a => a.type === 'weight_overflow').length > 0 && (
                            <span className="w-3 h-3 rounded-full bg-yellow-500" title={`超标 ${s.alerts.filter(a => a.type === 'weight_overflow').length}次`} />
                          )}
                          {s.alerts.length === 0 && (
                            <span className="text-xs text-slate-500">无</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const data = {
                                ...s,
                                exportedAt: new Date().toISOString(),
                              }
                              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `报告-${s.batchName}-${s.batchDate}.json`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}
                            className="p-1.5 rounded hover:bg-navy-600 text-slate-400 hover:text-gold-400 transition-colors"
                            title="导出"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定删除此报告？')) deleteSession(s.id)
                            }}
                            className="p-1.5 rounded hover:bg-navy-600 text-slate-400 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={14} className="text-slate-600 ml-1" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 p-4 glass-panel rounded-xl">
          <h3 className="text-sm font-medium text-slate-300 mb-2">📋 导出说明</h3>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>• 单个报告文件名格式：<code className="text-gold-400 font-mono">报告-批次名-日期.json</code></li>
            <li>• 批量导出文件名格式：<code className="text-gold-400 font-mono">报告批量导出-时间戳-共N份.json</code></li>
            <li>• 报告包含：完整曲线快照、组合历史、所有告警记录、最终评分</li>
            <li>• 数据存储在浏览器本地，清理缓存前请先导出备份</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
