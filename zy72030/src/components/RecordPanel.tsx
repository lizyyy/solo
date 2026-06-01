import { useState } from 'react'
import { Plus, MessageSquare, Tag, Clock, Star, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import { useActivityStore } from '@/store'
import { cn, formatDateTime, getColleagueFailureDetail } from '@/utils'
import {
  POLYHEDRON_TYPES,
  FAILURE_REASON_LABELS,
  FAILURE_REASON_COLLEAGUE,
  SOURCE_LABELS,
  RESULT_LABELS,
} from '@/types'
import type { RecordResult, FailureReason, RecordSource } from '@/types'

export default function RecordPanel() {
  const { currentActivity, records, addRecord, addSupplementRecord, updateRecordNote } = useActivityStore()
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormSource, setAddFormSource] = useState<RecordSource>('realtime')
  const [formPolyhedron, setFormPolyhedron] = useState<typeof POLYHEDRON_TYPES[number]>(POLYHEDRON_TYPES[0])
  const [formScore, setFormScore] = useState(0)
  const [formTime, setFormTime] = useState(5)
  const [formResult, setFormResult] = useState<RecordResult>('success')
  const [formFailureReason, setFormFailureReason] = useState<FailureReason>('rule_misunderstanding')
  const [formNote, setFormNote] = useState('')
  const [isNewStandard, setIsNewStandard] = useState(true)

  const canAddRealTime =
    currentActivity &&
    (currentActivity.status === 'running' || currentActivity.status === 'paused')
  const canAddSupplement = currentActivity

  const handleSubmitAdd = () => {
    const failureDetail =
      formResult !== 'success'
        ? getColleagueFailureDetail(formFailureReason, formPolyhedron, formScore, isNewStandard)
        : null

    const params = {
      polyhedronType: formPolyhedron,
      score: formScore,
      timeCostSeconds: formTime,
      result: formResult,
      failureReason: formResult !== 'success' ? formFailureReason : null,
      failureDetail,
      rawNote: formNote,
    }

    if (addFormSource === 'realtime') {
      addRecord(params)
    } else {
      addSupplementRecord({ ...params, source: addFormSource })
    }

    setShowAddForm(false)
    setFormNote('')
  }

  const startEditNote = (recordId: string, currentNote: string) => {
    setEditingNoteId(recordId)
    setNoteDraft(currentNote)
  }

  const saveNote = (recordId: string) => {
    updateRecordNote(recordId, noteDraft)
    setEditingNoteId(null)
    setNoteDraft('')
  }

  const getResultColor = (result: RecordResult) => {
    switch (result) {
      case 'success':
        return 'bg-emerald-500'
      case 'failure':
        return 'bg-red-500'
      case 'pending_review':
        return 'bg-amber-500'
    }
  }

  const getResultIcon = (result: RecordResult) => {
    switch (result) {
      case 'success':
        return <CheckCircle size={14} className="text-emerald-400" />
      case 'failure':
        return <XCircle size={14} className="text-red-400" />
      case 'pending_review':
        return <HelpCircle size={14} className="text-amber-400" />
    }
  }

  const getSourceColor = (source: RecordSource) => {
    switch (source) {
      case 'realtime':
        return 'bg-blue-900/60 text-blue-300 border-blue-700'
      case 'group_supplement':
        return 'bg-purple-900/60 text-purple-300 border-purple-700'
      case 'old_standard':
        return 'bg-orange-900/60 text-orange-300 border-orange-700'
    }
  }

  if (!currentActivity) {
    return (
      <div className="bg-[#16213e] rounded-xl p-6 border border-[#0f3460] h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Star size={48} className="mx-auto mb-3 opacity-30" />
          <p>请先开始一个活动</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#16213e] rounded-xl border border-[#0f3460] shadow-2xl flex flex-col h-full">
      <div className="p-4 border-b border-[#0f3460] flex items-center justify-between">
        <h3 className="text-lg font-bold text-white" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          探险记录面板
        </h3>
        <div className="flex gap-2">
          {canAddRealTime && (
            <button
              onClick={() => {
                setAddFormSource('realtime')
                setShowAddForm(true)
              }}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              <Plus size={14} />
              实时录入
            </button>
          )}
          {canAddSupplement && (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setAddFormSource('group_supplement')
                  setShowAddForm(true)
                }}
                className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <Tag size={14} />
                群聊补录
              </button>
              <button
                onClick={() => {
                  setAddFormSource('old_standard')
                  setShowAddForm(true)
                }}
                className="flex items-center gap-1 bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <Tag size={14} />
                旧口径
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {records.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无探险记录</p>
            <p className="text-xs text-gray-600 mt-1">样例数据将在首次录入后加载</p>
          </div>
        )}

        {records.map((record) => (
          <div
            key={record.id}
            className="bg-[#1a1a2e] rounded-lg border border-[#0f3460] overflow-hidden"
          >
            <div className="flex">
              <div className={cn('w-1.5', getResultColor(record.result))} />
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-[#f0a500] font-mono">
                      #{record.sequenceNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getResultIcon(record.result)}
                      <span className="text-sm font-medium text-white">
                        {RESULT_LABELS[record.result]}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded border',
                      getSourceColor(record.source)
                    )}
                  >
                    {SOURCE_LABELS[record.source]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Star size={14} className="text-[#f0a500]" />
                    <span>{record.polyhedronType}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Star size={14} className="text-yellow-400" />
                    <span>得分：{record.score}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock size={14} className="text-blue-400" />
                    <span>耗时：{record.timeCostSeconds} 秒</span>
                  </div>
                  {record.failureReason && (
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={14} />
                      <span>{FAILURE_REASON_LABELS[record.failureReason]}</span>
                    </div>
                  )}
                </div>

                {record.failureDetail && (
                  <div className="mb-3 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-300 leading-relaxed">
                    {record.failureDetail}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#0f3460]">
                  <MessageSquare size={14} className="text-gray-500 flex-shrink-0" />
                  {editingNoteId === record.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        className="flex-1 bg-[#0f3460] text-white text-sm px-3 py-1.5 rounded border border-gray-700 focus:border-[#f0a500] focus:outline-none"
                        placeholder="保留原始备注，不自动清洗..."
                      />
                      <button
                        onClick={() => saveNote(record.id)}
                        className="px-3 py-1.5 bg-[#f0a500] text-[#1a1a2e] text-sm font-medium rounded"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm text-gray-400 italic flex-1">
                        {record.rawNote || <span className="text-gray-600">（无备注，点击编辑）</span>}
                      </span>
                      <button
                        onClick={() => startEditNote(record.id, record.rawNote)}
                        className="text-xs text-gray-500 hover:text-[#f0a500] transition-colors"
                      >
                        编辑备注
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-600 font-mono">
                  处理时间：{formatDateTime(record.processedAt)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#16213e] rounded-xl border border-[#0f3460] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#0f3460]">
              <h3 className="text-lg font-bold text-white">
                {addFormSource === 'realtime' && '实时录入'}
                {addFormSource === 'group_supplement' && '活动复盘群补录'}
                {addFormSource === 'old_standard' && '旧口径录入'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {SOURCE_LABELS[addFormSource]} · 原始备注会完整保留，不自动清洗
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">多面体类型</label>
                <select
                  value={formPolyhedron}
                  onChange={(e) => setFormPolyhedron(e.target.value as typeof POLYHEDRON_TYPES[number])}
                  className="w-full bg-[#0f3460] text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-[#f0a500] focus:outline-none"
                >
                  {POLYHEDRON_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">得分</label>
                  <input
                    type="number"
                    value={formScore}
                    onChange={(e) => setFormScore(Number(e.target.value))}
                    className="w-full bg-[#0f3460] text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-[#f0a500] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">耗时（秒）</label>
                  <input
                    type="number"
                    value={formTime}
                    onChange={(e) => setFormTime(Number(e.target.value))}
                    className="w-full bg-[#0f3460] text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-[#f0a500] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1.5">结果</label>
                <div className="flex gap-2">
                  {(['success', 'failure', 'pending_review'] as RecordResult[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormResult(r)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                        formResult === r
                          ? r === 'success'
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : r === 'failure'
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-[#0f3460] border-gray-700 text-gray-400 hover:border-gray-500'
                      )}
                    >
                      {RESULT_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {formResult !== 'success' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">失败原因</label>
                    <select
                      value={formFailureReason}
                      onChange={(e) => setFormFailureReason(e.target.value as FailureReason)}
                      className="w-full bg-[#0f3460] text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-[#f0a500] focus:outline-none"
                    >
                      {(Object.keys(FAILURE_REASON_LABELS) as FailureReason[]).map((key) => (
                        <option key={key} value={key}>
                          {FAILURE_REASON_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formFailureReason === 'rule_misunderstanding' && (
                    <div className="flex items-center gap-3 p-3 bg-[#0f3460] rounded-lg">
                      <input
                        type="checkbox"
                        id="newStandard"
                        checked={isNewStandard}
                        onChange={(e) => setIsNewStandard(e.target.checked)}
                        className="w-4 h-4 accent-[#f0a500]"
                      />
                      <label htmlFor="newStandard" className="text-sm text-gray-300">
                        按新口径（按顶点数计分），不是旧口径（按面数计分）
                      </label>
                    </div>
                  )}

                  <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg text-sm text-blue-300">
                    <strong>同事提示：</strong>
                    {FAILURE_REASON_COLLEAGUE[formFailureReason]}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-1.5">原始备注</label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0f3460] text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-[#f0a500] focus:outline-none resize-none"
                  placeholder="保留原始备注原样，不自动清洗。例如：群聊记录：xxx、小何说这条再看看..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitAdd}
                  className="flex-1 px-4 py-2.5 bg-[#f0a500] text-[#1a1a2e] rounded-lg font-semibold hover:bg-[#f5b624] transition-colors"
                >
                  确认添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
