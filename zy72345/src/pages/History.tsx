import { useEffect, useState } from 'react'
import { RotateCcw, Filter, Eye } from 'lucide-react'
import { useStore, type ChangeLogEntry } from '@/store'
import ChangeDiff from '@/components/ChangeDiff'
import ConfirmModal from '@/components/ConfirmModal'

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
  update_remark: '修改备注',
  correct_value: '修正值',
  boundary_detected: '边界检测',
}

const actionColors: Record<string, string> = {
  rollback: 'bg-rose-500/10 text-rose-400',
  confirm: 'bg-emerald-500/10 text-emerald-400',
  update_remark: 'bg-amber-500/10 text-amber-400',
  correct_value: 'bg-blue-500/10 text-blue-400',
  boundary_detected: 'bg-purple-500/10 text-purple-400',
  update: 'bg-blue-500/10 text-blue-400',
  import: 'bg-blue-500/10 text-blue-400',
  ignore: 'bg-slate-600/30 text-slate-400',
}

function DetailModal({ entry, onClose }: { entry: ChangeLogEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>变更详情</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">×</button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 text-xs">ID</span>
              <p className="text-slate-300 font-mono text-xs">{entry.id.slice(0, 12)}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">实体类型</span>
              <p className="text-slate-300">{entityTypeLabels[entry.entityType] || entry.entityType}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">实体ID</span>
              <p className="text-slate-300 font-mono text-xs">{entry.entityId.slice(0, 12)}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">操作</span>
              <p>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[entry.action] || actionColors.update}`}>
                  {actionLabels[entry.action] || entry.action}
                </span>
              </p>
            </div>
          </div>
          {entry.field && (
            <div>
              <span className="text-slate-500 text-xs">字段</span>
              <p className="text-slate-300">{entry.field}</p>
            </div>
          )}
          {entry.oldValue && (
            <div>
              <span className="text-slate-500 text-xs">旧值</span>
              <p className="line-through text-rose-400 bg-rose-500/10 px-2 py-1 rounded">{entry.oldValue}</p>
            </div>
          )}
          {entry.newValue && (
            <div>
              <span className="text-slate-500 text-xs">新值</span>
              <p className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">{entry.newValue}</p>
            </div>
          )}
          <div>
            <span className="text-slate-500 text-xs">操作人</span>
            <p className="text-slate-300">{entry.operator} ({entry.operatorRole})</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs">时间</span>
            <p className="text-slate-400">{new Date(entry.timestamp).toLocaleString('zh-CN')}</p>
          </div>
          {entry.humanReadable && (
            <div>
              <span className="text-slate-500 text-xs">人话描述</span>
              <p className="text-amber-400">{entry.humanReadable}</p>
            </div>
          )}
          {entry.affectedEntities && entry.affectedEntities.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs">受影响实体</span>
              <p className="text-slate-300">{entry.affectedEntities.join('、')}</p>
            </div>
          )}
          <div>
            <span className="text-slate-500 text-xs">可回滚</span>
            <p className={entry.canRollback ? 'text-emerald-400' : 'text-slate-500'}>{entry.canRollback ? '是' : '否'}</p>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-amber-500 text-slate-900 rounded-lg font-medium hover:bg-amber-400 transition-colors">关闭</button>
        </div>
      </div>
    </div>
  )
}

export default function History() {
  const { changeLog, changeLogTotal, loading, userRole, fetchChangeLog, rollbackChange, getChangeLogDetail } = useStore()
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [rollbackTarget, setRollbackTarget] = useState<ChangeLogEntry | null>(null)
  const [rollbackDetail, setRollbackDetail] = useState<ChangeLogEntry | null>(null)
  const [detailTarget, setDetailTarget] = useState<ChangeLogEntry | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchChangeLog({ entityType: entityType || undefined, action: action || undefined, page })
  }, [entityType, action, dateFrom, dateTo, page])

  const handleRollbackClick = async (entry: ChangeLogEntry) => {
    setLoadingDetail(true)
    try {
      const detail = await getChangeLogDetail(entry.id)
      setRollbackDetail(detail)
      setRollbackTarget(entry)
    } catch {}
    setLoadingDetail(false)
  }

  const handleRollback = async () => {
    if (!rollbackTarget) return
    try {
      await rollbackChange(rollbackTarget.id)
      setRollbackTarget(null)
      setRollbackDetail(null)
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
            <option value="update_remark">修改备注</option>
            <option value="correct_value">修正值</option>
            <option value="boundary_detected">边界检测</option>
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
        <table className="w-full min-w-[1000px]">
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
              changeLog.map(entry => {
                const isRemarkUpdate = entry.action === 'update_remark' || entry.field === 'remark'
                return (
                  <tr key={entry.id} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300">
                        {entityTypeLabels[entry.entityType] || entry.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{entry.entityId.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[entry.action] || actionColors.update}`}>
                          {actionLabels[entry.action] || entry.action}
                        </span>
                        {isRemarkUpdate && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400">
                            单条备注修改
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{entry.field || '-'}</td>
                    <td className="px-4 py-3 text-sm max-w-xs">
                      {isRemarkUpdate && entry.oldValue && entry.newValue ? (
                        <div className="max-w-xs">
                          <ChangeDiff oldText={entry.oldValue} newText={entry.newValue} />
                        </div>
                      ) : (
                        <div>
                          {entry.oldValue && <span className="line-through text-rose-400 mr-1">{entry.oldValue}</span>}
                          {entry.newValue && <span className="text-emerald-400">{entry.newValue}</span>}
                          {!entry.oldValue && !entry.newValue && <span className="text-slate-500">-</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{entry.operator}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDetailTarget(entry)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 rounded transition-colors"
                        >
                          <Eye size={12} />
                          详情
                        </button>
                        {entry.canRollback && userRole === '教研负责人' && (
                          <button
                            onClick={() => handleRollbackClick(entry)}
                            disabled={loadingDetail}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-50"
                          >
                            <RotateCcw size={12} />
                            回滚
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
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

      {rollbackTarget && rollbackDetail && (
        <ConfirmModal
          isOpen={true}
          title="确认回滚"
          description={`将执行：${rollbackDetail.humanReadable || `回滚 ${actionLabels[rollbackTarget.action] || rollbackTarget.action} 操作`}`}
          preview={rollbackDetail.rollbackPreview ?? (rollbackDetail.oldValue && rollbackDetail.newValue ? { from: rollbackDetail.newValue, to: rollbackDetail.oldValue } : undefined)}
          warn={`受影响范围：${rollbackDetail.affectedEntities?.join('、') ?? '未知'}。回滚后不可再次回滚此条记录，将生成新的回滚日志。`}
          confirmText="确认回滚"
          cancelText="取消"
          onConfirm={handleRollback}
          onCancel={() => { setRollbackTarget(null); setRollbackDetail(null) }}
        />
      )}

      {detailTarget && (
        <DetailModal entry={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  )
}
