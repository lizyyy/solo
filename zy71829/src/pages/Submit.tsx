import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus, AlertTriangle, CheckCircle, ExternalLink, Send } from 'lucide-react'
import { useQueueStore } from '@/store'
import type { SourceType } from '@shared/types'

export default function Submit() {
  const navigate = useNavigate()
  const { createRecord, submitResult, clearSubmitResult, loading, error, clearError } = useQueueStore()

  const [activityId, setActivityId] = useState('')
  const [source, setSource] = useState<SourceType>('活动复盘')
  const [submittedBy, setSubmittedBy] = useState('负责人陈')
  const [content, setContent] = useState('')

  useEffect(() => {
    return () => {
      clearSubmitResult()
      clearError()
    }
  }, [clearSubmitResult, clearError])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearSubmitResult()
    await createRecord({ activityId, source, submittedBy, content })
  }

  const handleDismiss = () => {
    clearSubmitResult()
  }

  const isDuplicate = submitResult?.isDuplicate
  const isSuccess = submitResult && !submitResult.isDuplicate
  const recordId = isDuplicate ? submitResult.relatedExistingId : (isSuccess ? submitResult.relatedExistingId : undefined)

  const resetForm = () => {
    setActivityId('')
    setSource('活动复盘')
    setSubmittedBy('负责人陈')
    setContent('')
  }

  useEffect(() => {
    if (isSuccess) {
      resetForm()
    }
  }, [isSuccess])

  const sourceOptions: SourceType[] = ['活动复盘', '关卡草表']

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-port-orange/15 flex items-center justify-center">
          <FilePlus className="w-5 h-5 text-port-orange" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-port-text">材料提交</h2>
          <p className="text-sm text-port-muted">提交新的活动材料到排队系统</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isDuplicate && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-400 text-sm font-medium">
              检测到重复提交！活动ID {activityId} 已存在记录
            </p>
            {recordId && (
              <button
                onClick={() => navigate(`/record/${recordId}`)}
                className="mt-2 inline-flex items-center gap-1.5 text-amber-300 text-sm hover:text-amber-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                查看已有记录
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-amber-400/60 hover:text-amber-300 text-sm transition-colors"
          >
            关闭
          </button>
        </div>
      )}

      {isSuccess && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-emerald-400 text-sm font-medium">材料提交成功！记录已创建</p>
            {recordId && (
              <button
                onClick={() => navigate(`/record/${recordId}`)}
                className="mt-2 inline-flex items-center gap-1.5 text-emerald-300 text-sm hover:text-emerald-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                查看新记录
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-emerald-400/60 hover:text-emerald-300 text-sm transition-colors"
          >
            关闭
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-port-card border border-port-border rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-port-text mb-1.5">
            活动ID <span className="text-port-orange">*</span>
          </label>
          <input
            type="text"
            required
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
            placeholder="请输入活动ID"
            className="w-full px-3.5 py-2.5 rounded-lg bg-port-surface border border-port-border text-port-text placeholder-port-muted text-sm focus:outline-none focus:ring-2 focus:ring-port-orange/50 focus:border-port-orange transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-port-text mb-1.5">
            来源类型 <span className="text-port-orange">*</span>
          </label>
          <select
            required
            value={source}
            onChange={(e) => setSource(e.target.value as SourceType)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-port-surface border border-port-border text-port-text text-sm focus:outline-none focus:ring-2 focus:ring-port-orange/50 focus:border-port-orange transition-all appearance-none cursor-pointer"
          >
            {sourceOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-port-text mb-1.5">
            提交人 <span className="text-port-orange">*</span>
          </label>
          <input
            type="text"
            required
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            placeholder="请输入提交人"
            className="w-full px-3.5 py-2.5 rounded-lg bg-port-surface border border-port-border text-port-text placeholder-port-muted text-sm focus:outline-none focus:ring-2 focus:ring-port-orange/50 focus:border-port-orange transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-port-text mb-1.5">
            内容 <span className="text-port-orange">*</span>
          </label>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入材料内容"
            rows={5}
            className="w-full px-3.5 py-2.5 rounded-lg bg-port-surface border border-port-border text-port-text placeholder-port-muted text-sm focus:outline-none focus:ring-2 focus:ring-port-orange/50 focus:border-port-orange transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-port-orange text-white font-medium text-sm hover:bg-port-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {loading ? '提交中...' : '提交材料'}
        </button>
      </form>
    </div>
  )
}
