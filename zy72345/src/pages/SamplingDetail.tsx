import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Database, FileSpreadsheet, Download, Package, Edit3, Save, X, History } from 'lucide-react'
import { useStore, type SamplingRecord } from '@/store'

const statusLabels: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  ignored: '已忽略',
}

const oldStatusLabels: Record<string, string> = {
  normal: '正常',
  missing: '缺失',
  anomaly: '异常',
}

function RemarkEditor({
  record,
  onSave,
  onCancel,
}: {
  record: SamplingRecord
  onSave: (remark: string) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(record.remark)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 resize-none"
        rows={2}
        autoFocus
      />
      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
        >
          <Save size={12} />
          保存
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-600/30 text-slate-400 rounded hover:bg-slate-600/50 transition-colors"
        >
          <X size={12} />
          取消
        </button>
      </div>
    </div>
  )
}

function RemarkHistory({ history }: { history: { time: string; operator: string; operatorRole: string; oldValue: string; newValue: string }[] }) {
  if (!history || history.length === 0) return null
  return (
    <div className="mt-2 pl-4 border-l-2 border-slate-700 space-y-2">
      <p className="text-xs text-slate-500 flex items-center gap-1">
        <History size={12} />
        备注修改历史
      </p>
      {history.map((h, i) => (
        <div key={i} className="bg-slate-800/30 rounded-lg p-2 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-slate-300">{h.operator}</span>
            <span className="text-slate-500">({h.operatorRole})</span>
            <span className="text-slate-600">{new Date(h.time).toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="line-through text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{h.oldValue || '(空)'}</span>
            <span className="text-slate-500">→</span>
            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{h.newValue || '(空)'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RecordRow({
  record,
  userRole,
  onUpdateRemark,
}: {
  record: SamplingRecord
  userRole: string
  onUpdateRemark: (recordId: string, remark: string) => Promise<void>
}) {
  const [editingRemark, setEditingRemark] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const handleSave = async (remark: string) => {
    await onUpdateRemark(record.id, remark)
    setEditingRemark(false)
    setShowHistory(true)
  }

  return (
    <>
      <tr className={`border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors ${record.isBoundary ? 'border-l-2 border-l-amber-500' : ''}`}>
        <td className="px-4 py-3 text-slate-200 font-mono text-xs">
          {(record.traceableId || record.id).slice(0, 8)}
        </td>
        <td className="px-4 py-3 text-slate-300 font-mono text-xs">
          {(record.batchId || '').slice(0, 8) || '-'}
        </td>
        <td className="px-4 py-3 text-slate-200 font-mono">{record.originalValue}</td>
        <td className="px-4 py-3">
          {record.isNegative ? <span className="text-rose-500">是</span> : <span className="text-slate-500">否</span>}
        </td>
        <td className="px-4 py-3 text-slate-400">{oldStatusLabels[record.oldTableStatus] || record.oldTableStatus}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            record.boundaryStatus === 'pending' ? 'bg-amber-500/10 text-amber-500' :
            record.boundaryStatus === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500' :
            'bg-slate-600/30 text-slate-400'
          }`}>
            {statusLabels[record.boundaryStatus]}
          </span>
        </td>
        <td className="px-4 py-3 text-sm max-w-xs">
          {editingRemark ? (
            <RemarkEditor
              record={record}
              onSave={handleSave}
              onCancel={() => setEditingRemark(false)}
            />
          ) : (
            <div
              onClick={() => setEditingRemark(true)}
              className="group flex items-start gap-1 cursor-pointer hover:bg-slate-700/30 rounded p-1 -m-1"
            >
              <span className="text-slate-400 truncate flex-1">{record.remark || '-'}</span>
              <Edit3 size={12} className="text-slate-600 group-hover:text-amber-500 shrink-0 mt-0.5" />
            </div>
          )}
          {!editingRemark && (record.remarkHistory?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="mt-1 text-xs text-slate-500 hover:text-amber-500 flex items-center gap-1"
            >
              <History size={10} />
              {showHistory ? '收起历史' : `${record.remarkHistory?.length}条修改`}
            </button>
          )}
        </td>
      </tr>
      {showHistory && (record.remarkHistory?.length ?? 0) > 0 && (
        <tr className="bg-slate-800/20">
          <td colSpan={7} className="px-4 py-2">
            <RemarkHistory history={record.remarkHistory!} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function SamplingDetail() {
  const { id } = useParams<{ id: string }>()
  const { currentList, samplingRecords, relatedParams, loading, userRole, fetchSamplingDetail, updateRecordRemark, exportSampling } = useStore()

  useEffect(() => {
    if (id) fetchSamplingDetail(id)
  }, [id])

  const handleUpdateRemark = async (recordId: string, remark: string) => {
    await updateRecordRemark(recordId, remark, userRole, userRole)
  }

  if (loading.samplingDetail) {
    return <div className="text-slate-400 text-center py-12">加载中...</div>
  }

  if (!currentList) {
    return <div className="text-slate-400 text-center py-12">名单不存在</div>
  }

  const importHistory = currentList.importHistory ?? []
  const batchCount = currentList.duplicateImportCount ?? 1

  return (
    <div className="space-y-6">
      <Link to="/sampling" className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 text-sm transition-colors">
        <ArrowLeft size={16} />
        返回抽样名单
      </Link>

      <div className="flex items-start justify-between">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5 flex-1">
          <h2 className="text-xl font-bold text-slate-100 mb-3" style={{ fontFamily: 'var(--font-title)' }}>{currentList.name}</h2>
          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-1"><Clock size={14} /> {new Date(currentList.importTime).toLocaleString('zh-CN')}</span>
            <span className="flex items-center gap-1"><Database size={14} /> {currentList.recordCount} 条记录</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${currentList.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-600/30 text-slate-400'}`}>
              {currentList.status === 'active' ? '活跃' : '已归档'}
            </span>
          </div>
        </div>
        <button
          onClick={() => exportSampling(currentList.id)}
          className="inline-flex items-center gap-1.5 ml-4 px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700 hover:text-amber-500 transition-colors"
        >
          <Download size={16} />
          导出此名单
        </button>
      </div>

      {batchCount > 1 && (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-amber-500/30 p-5">
          <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-title)' }}>
            <Package size={18} className="text-amber-500" />
            历史导入批次
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {importHistory.length > 0 ? (
              importHistory.map((h, i) => (
                <div key={i} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300">
                      第 {i + 1} 次
                    </span>
                    {i > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500">
                        重复
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-1">
                    <span className="text-slate-500">批次号：</span>
                    <span className="font-mono text-slate-300">{h.batchId.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500">时间：</span>
                    {new Date(h.time).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-slate-500 text-sm py-4">
                暂无历史批次详情
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">可追溯ID</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">批次号</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">原始值</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">负数</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">旧表状态</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">边界状态</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {samplingRecords.map(record => (
              <RecordRow
                key={record.id}
                record={record}
                userRole={userRole}
                onUpdateRemark={handleUpdateRemark}
              />
            ))}
          </tbody>
        </table>
      </div>

      {relatedParams.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-200" style={{ fontFamily: 'var(--font-title)' }}>关联参数</h3>
            <Link to="/params" className="text-sm text-amber-500 hover:text-amber-400 transition-colors">
              前往参数页 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relatedParams.map(param => (
              <div key={param.id} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3">
                <span className="text-slate-300 text-sm">{param.key}</span>
                <span className="text-amber-500 font-mono text-sm">{param.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
