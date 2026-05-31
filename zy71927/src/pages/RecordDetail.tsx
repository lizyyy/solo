import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Plus, FileText, Edit3, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'
import EvidenceTimeline from '@/components/EvidenceTimeline'
import LinkedInsurancePanel from '@/components/LinkedInsurancePanel'
import LinkedExhibitionPanel from '@/components/LinkedExhibitionPanel'
import ConfirmationsList from '@/components/ConfirmationsList'
import type { CorrectionEntry, Confirmation } from '@/types'

const fieldLabels: Record<string, string> = {
  description: '描述',
  restorer: '修复师',
  status: '状态',
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    getRecordById,
    addConfirmation,
    addCorrection,
    revertCorrection,
  } = useStore()

  const [field, setField] = useState<CorrectionEntry['field']>('description')
  const [oldValue, setOldValue] = useState('')
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [highlightPanel, setHighlightPanel] = useState<string | null>(null)

  const record = id ? getRecordById(id) : undefined

  if (!record) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-900 mb-4">记录不存在</p>
          <button
            onClick={() => navigate('/')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg',
              'hover:bg-gray-800 transition-colors'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const handleAddCorrection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldValue.trim() || !newValue.trim() || !reason.trim()) return

    const correction: CorrectionEntry = {
      id: `correction-${Date.now()}`,
      recordId: record.id,
      field,
      oldValue: oldValue.trim(),
      newValue: newValue.trim(),
      reason: reason.trim(),
      reverted: false,
      revertedAt: null,
      revertedBy: null,
      timestamp: new Date().toISOString(),
      operator: '当前用户',
    }

    addCorrection(record.id, correction)
    setOldValue('')
    setNewValue('')
    setReason('')
  }

  const handleAddConfirmation = (confirmation: Confirmation) => {
    addConfirmation(record.id, confirmation)
  }

  const handleRevertCorrection = (correctionId: string) => {
    revertCorrection(record.id, correctionId, '当前用户')
  }

  const handleTimelineNavigate = (type: 'insurance' | 'lighting' | 'exhibition') => {
    const panelId = type === 'insurance' ? 'insurance-panel' : 'exhibition-panel'
    const panel = document.getElementById(panelId)
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightPanel(panelId)
      setTimeout(() => setHighlightPanel(null), 2000)
    }
  }

  return (
    <div className="min-h-full">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <h1 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
          修复记录详情
        </h1>
        <p className="text-gray-600">
          {record.artifactName} - {record.artifactId}
        </p>
      </div>

      <div className="flex gap-6">
        <div className="w-2/3 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">基本信息</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">文物名称</label>
                <p className="text-gray-900 font-medium">{record.artifactName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">文物编号</label>
                <p className="text-gray-900">{record.artifactId}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">修复师</label>
                <p className="text-gray-900">{record.restorer}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">状态</label>
                <div className="mt-1">
                  <StatusBadge status={record.status} />
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-500">描述</label>
                <p className="text-gray-900">{record.description}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">创建时间</label>
                <p className="text-gray-900">
                  {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">更新时间</label>
                <p className="text-gray-900">
                  {format(new Date(record.updatedAt), 'yyyy-MM-dd HH:mm')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">证据链</h2>
            </div>
            <EvidenceTimeline
              entries={record.evidenceChain}
              onNavigate={handleTimelineNavigate}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">更正历史</h2>
            </div>
            <div className="space-y-3 mb-6">
              {record.correctionHistory.length > 0 ? (
                record.correctionHistory.map((correction) => (
                  <div
                    key={correction.id}
                    className={cn(
                      'p-4 border rounded-lg',
                      correction.reverted ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs font-medium px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                          {fieldLabels[correction.field] || correction.field}
                        </span>
                        {correction.reverted && (
                          <span className="ml-2 text-xs text-gray-500">已撤销</span>
                        )}
                      </div>
                      {!correction.reverted && (
                        <button
                          onClick={() => handleRevertCorrection(correction.id)}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                        >
                          <Undo2 className="w-4 h-4" />
                          撤销
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
                      <div>
                        <span className="text-gray-500">原值:</span>
                        <p className="text-gray-900 line-through">{correction.oldValue}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">新值:</span>
                        <p className="text-gray-900">{correction.newValue}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">原因:</span> {correction.reason}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>操作人: {correction.operator}</span>
                      <span>{format(new Date(correction.timestamp), 'yyyy-MM-dd HH:mm')}</span>
                    </div>
                    {correction.reverted && correction.revertedAt && (
                      <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                        <span>撤销人: {correction.revertedBy}</span>
                        <span className="ml-4">
                          撤销时间: {format(new Date(correction.revertedAt), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无更正记录
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">添加更正</h3>
              </div>
              <form onSubmit={handleAddCorrection} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      字段
                    </label>
                    <select
                      value={field}
                      onChange={(e) => setField(e.target.value as CorrectionEntry['field'])}
                      className={cn(
                        'w-full px-3 py-2 border border-gray-300 rounded-lg',
                        'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm'
                      )}
                    >
                      <option value="description">描述</option>
                      <option value="restorer">修复师</option>
                      <option value="status">状态</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      原值
                    </label>
                    <input
                      type="text"
                      value={oldValue}
                      onChange={(e) => setOldValue(e.target.value)}
                      placeholder="输入原值"
                      className={cn(
                        'w-full px-3 py-2 border border-gray-300 rounded-lg',
                        'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      新值
                    </label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="输入新值"
                      className={cn(
                        'w-full px-3 py-2 border border-gray-300 rounded-lg',
                        'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm'
                      )}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原因
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="输入更正原因"
                    rows={3}
                    className={cn(
                      'w-full px-3 py-2 border border-gray-300 rounded-lg',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none'
                    )}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!oldValue.trim() || !newValue.trim() || !reason.trim()}
                  className={cn(
                    'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm',
                    'hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors'
                  )}
                >
                  提交更正
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="w-1/3 space-y-4">
          <div className="sticky top-8 space-y-4">
            <LinkedInsurancePanel
              record={record}
              className={cn(
                'transition-all duration-300',
                highlightPanel === 'insurance-panel' && 'ring-2 ring-blue-500 ring-offset-2'
              )}
            />
            <LinkedExhibitionPanel
              record={record}
              className={cn(
                'transition-all duration-300',
                highlightPanel === 'exhibition-panel' && 'ring-2 ring-purple-500 ring-offset-2'
              )}
            />
            <ConfirmationsList
              confirmations={record.confirmations}
              onAdd={handleAddConfirmation}
              recordId={record.id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
