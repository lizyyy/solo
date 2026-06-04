import { useEffect, useState } from 'react'
import { RotateCcw, Filter } from 'lucide-react'
import { useStore, type ChangeLogEntry } from '@/store'
import ChangeDiff from '@/components/ChangeDiff'

const entityTypeLabels: Record<string, string> = {
  sampling: '抽样名单',
  param: '参数',
  boundary: '边界样本',
}

const actionLabels: Record<string, string> = {
  import: '导入',
  update: '更新',
  confirm: '确认',
  ignore: '忽略',
  rollback: '回滚',
}

function RollbackModal({ entry, onConfirm, onClose }: { entry: ChangeLogEntry; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-2" style={{ fontFamily: 'var(--font-title)' }}>确认回滚</h3>
        <p className="text-slate-400 text-sm mb-4">即将回滚以下变更，此操作不可撤销：</p>
        <div className="bg-slate-800/30 rounded-lg p-3 text-sm space-y-1 mb-4">
          <p className="text-slate-300">操作: {actionLabels[entry.action] || entry.action}</p>
          <p className="text-slate-300">实体: {entityTypeLabels[entry.entityType] || entry.entityType}/{entry.entityId.slice(0, 8)}</p>
          {entry.field && <p className="text-slate-300">字段: {entry.field}</p>}
          {entry.oldValue && <p className="text-slate-400">旧值: <span className="text-rose-400">{entry.oldValue}</span></p>}
          {entry.newValue && <p className="text-slate-400">新值: <span className="text-emerald-400">{entry.newValue}</span></p>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">取消</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-400 transition-colors">确认回滚</button>
        </div>
      </div>
    </div>
  )
}

export default function History() {
  const { changeLog, changeLogTotal, loading, userRole, fetchChangeLog, rollbackChange } = useStore()
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [rollbackTarget, setRollbackTarget] = useState<ChangeLogEntry | null>(null)

  useEffect(() => {
    fetchChangeLog({ entityType: entityType || undefined, action: action || undefined, page })
  }, [entityType, action, dateFrom, dateTo, page])

  const handleRollback = async () => {
    if (!rollbackTarget) return
    try {
      await rollbackChange(rollbackTarget.id)
      setRollbackTarget(null)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>变更历史</h2>

      <div className="flex flex-wrap items-end gap-3 bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4">
        <Filter size={18} className="text-slate-400" />
        <div>
          <label className="text-xs text-slate-500 block mb-1">实体类型</label>
          <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1) }} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
            <option value="">全部</option>
            <option value="sampling">抽样名单</option>
            <option value="param">参数</option>
            <option value="boundary">边界样本</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">操作类型</label>
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
            <option value="">全部</option>
            <option value="import">导入</option>
            <option value="update">更新</option>
            <option value="confirm">确认</option>
            <option value="ignore">忽略</option>
            <option value="rollback">回滚</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">开始日期</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">结束日期</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200" />
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">实体类型</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">实体ID</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">操作</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">字段</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">变更内容</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">操作人</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">时间</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {changeLog.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">暂无变更记录</td></tr>
            ) : (
              changeLog.map(entry => (
                <tr key={entry.id} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300">
                      {entityTypeLabels[entry.entityType] || entry.entityType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{entry.entityId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      entry.action === 'rollback' ? 'bg-rose-500/10 text-rose-400' :
                      entry.action === 'confirm' ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {actionLabels[entry.action] || entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{entry.field || '-'}</td>
                  <td className="px-4 py-3 text-sm max-w-xs">
                    {entry.field === 'remark' && entry.oldValue && entry.newValue ? (
                      <div className="max-w-xs">
                        <ChangeDiff oldText={entry.oldValue} newText={entry.newValue} />
                      </div>
                    ) : (
                      <div>
                        {entry.oldValue && <span className="line-through text-rose-400 mr-1">{entry.oldValue}</span>}
                        {entry.newValue && <span className="text-emerald-400">{entry.newValue}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{entry.operator}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3">
                    {entry.canRollback && userRole === '教研负责人' && (
                      <button
                        onClick={() => setRollbackTarget(entry)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                      >
                        <RotateCcw size={12} />
                        回滚
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">共 {changeLogTotal} 条记录</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors">上一页</button>
          <span className="px-3 py-1 text-slate-400">{page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={changeLog.length < 20} className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors">下一页</button>
        </div>
      </div>

      {rollbackTarget && (
        <RollbackModal entry={rollbackTarget} onConfirm={handleRollback} onClose={() => setRollbackTarget(null)} />
      )}
    </div>
  )
}
