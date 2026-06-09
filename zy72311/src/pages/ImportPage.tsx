import { useState, useCallback, useEffect } from 'react'
import { Upload, AlertCircle, FileUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'

export default function ImportPage() {
  const { questionnaireRecords, questionnaireSummary, boundaryNotes, conflicts, loading, error, importData, fetchDashboard } = useStore()
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const zeroDenomCount = questionnaireSummary.zeroDenominator
  const supplementedCount = questionnaireSummary.supplemented
  const normalCount = questionnaireSummary.normal
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length
  const hasAnomalies = zeroDenomCount > 0 || supplementedCount > 0 || pendingConflicts > 0

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      await importData(text)
    },
    [importData]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const getBoundaryNoteInfo = (record: any) => {
    if (!record.boundaryNoteId) return null
    const note = boundaryNotes.find((n) => n.id === record.boundaryNoteId)
    if (note) return note.title
    return `#${record.boundaryNoteId.slice(-8)}`
  }

  const getOriginalStatementSummary = (text: string | undefined) => {
    if (!text) return '-'
    return text.length > 25 ? text.slice(0, 25) + '...' : text
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">问卷导入</h2>
        <span className="text-xs text-slate-500">上传CSV格式的问卷数据</span>
      </div>

      {questionnaireRecords.length > 0 && hasAnomalies && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-400 mb-2">检测到异常数据</div>
            <div className="text-xs text-slate-400 mb-2">
              正常 <span className="text-emerald-400">{normalCount}</span> 条 ·
              {zeroDenomCount > 0 && <span> 分母为0 <span className="text-rose-400">{zeroDenomCount}</span> 条 ·</span>}
              {supplementedCount > 0 && <span> 已补录 <span className="text-amber-400">{supplementedCount}</span> 条 ·</span>}
              {pendingConflicts > 0 && <span> 边界值冲突 <span className="text-rose-400">{pendingConflicts}</span> 条 ·</span>}
              待复核 <span className="text-amber-400">{questionnaireSummary.pendingReview}</span> 条
            </div>
            <div className="space-y-1 text-xs">
              {zeroDenomCount > 0 && (
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="text-rose-400">分母为0：</span>
                  <Link to="/review" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5 underline underline-offset-2">
                    前往数据复核页面处理 <ArrowRight size={10} />
                  </Link>
                </div>
              )}
              {pendingConflicts > 0 && (
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="text-rose-400">边界值冲突：</span>
                  <Link to="/conflicts" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5 underline underline-offset-2">
                    前往冲突处理页面处理 <ArrowRight size={10} />
                  </Link>
                </div>
              )}
              {questionnaireSummary.pendingReview > 0 && (
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="text-amber-400">待复核：</span>
                  <Link to="/review" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5 underline underline-offset-2">
                    前往数据复核页面处理 <ArrowRight size={10} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all duration-200 ${
          dragOver
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/30'
        }`}
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${dragOver ? 'bg-amber-500/20' : 'bg-slate-700'}`}>
          {loading ? (
            <FileUp size={28} className="text-amber-500 animate-bounce" />
          ) : (
            <Upload size={28} className={dragOver ? 'text-amber-500' : 'text-slate-400'} />
          )}
        </div>
        <div className="text-sm text-slate-300 mb-2">
          {loading ? '正在导入...' : '拖拽CSV文件到此处'}
        </div>
        <div className="text-xs text-slate-500 mb-4">或点击选择文件</div>
        <label className="btn-primary cursor-pointer">
          选择文件
          <input type="file" accept=".csv" onChange={handleInputChange} className="hidden" />
        </label>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {questionnaireRecords.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">数据预览</span>
            <span className="text-xs text-slate-500">共 {questionnaireRecords.length} 条记录</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">指标名称</th>
                  <th className="px-4 py-3 text-right">权重</th>
                  <th className="px-4 py-3 text-right">得分</th>
                  <th className="px-4 py-3 text-right">分母</th>
                  <th className="px-4 py-3 text-left">类型</th>
                  <th className="px-4 py-3 text-left">来源</th>
                  <th className="px-4 py-3 text-left">关联边界值说明</th>
                  <th className="px-4 py-3 text-left">原始说法</th>
                  <th className="px-4 py-3 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {questionnaireRecords.map((record, idx) => {
                  const boundaryNoteInfo = getBoundaryNoteInfo(record)
                  return (
                    <tr
                      key={record.id}
                      className={`table-row ${
                        record.recordType === 'zero_denominator_empty'
                          ? 'border-l-2 border-l-rose-500'
                          : record.recordType === 'supplemented'
                          ? 'border-l-2 border-l-amber-500'
                          : ''
                      } ${idx % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-300 font-medium">{record.targetName}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{record.weight.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{record.score.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{record.denominator.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={record.recordType} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="source" source={record.source} />
                      </td>
                      <td className="px-4 py-3 text-xs text-amber-400 max-w-[160px] truncate">
                        {boundaryNoteInfo || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">
                        {getOriginalStatementSummary(record.originalStatement)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
