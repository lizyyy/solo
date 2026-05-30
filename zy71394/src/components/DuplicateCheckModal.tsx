import { useEffect, useState } from 'react'
import { X, AlertTriangle, ArrowRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import type { DuplicateCheckResult } from '../../shared/types'
import { getRatingColor, similarityLabel, similarityColor } from '@/components/StatusBadges'
import { cn } from '@/lib/utils'

interface DuplicateCheckModalProps {
  title: string
  content: string
  excludeId?: string
  onClose: () => void
  onContinue?: () => void
}

export default function DuplicateCheckModal({
  title,
  content,
  excludeId,
  onClose,
  onContinue,
}: DuplicateCheckModalProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<DuplicateCheckResult | null>(null)

  useEffect(() => {
    checkDuplicates()
  }, [title, content, excludeId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkDuplicates() {
    setLoading(true)
    try {
      const data = await api.prompts.checkDuplicates(title, content, excludeId)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  function handleContinue() {
    onContinue?.()
    onClose()
  }

  function handleNavigateTo(promptId: string) {
    navigate(`/archive/${promptId}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-2xl max-h-[80vh] flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-warning/20">
              <AlertTriangle className="w-5 h-5 text-status-warning" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">重复检测结果</h3>
              <p className="text-sm text-gray-400">
                {loading ? '正在检测...' : result?.hasDuplicate ? `发现 ${result.duplicates.length} 条相似提示词` : '未发现重复'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
            </div>
          ) : !result?.hasDuplicate ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-status-success/20 flex items-center justify-center">
                <Plus className="w-8 h-8 text-status-success" />
              </div>
              <p className="text-gray-200 font-medium">未发现重复提示词</p>
              <p className="text-sm text-gray-400 mt-1">可以安全录入新提示词</p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.duplicates.map((item, index) => (
                <div
                  key={item.promptId}
                  className="p-4 border border-bg-border rounded-lg bg-bg-lighter/50 hover:bg-bg-lighter transition-colors"
                  style={{ animation: `fade-in 0.2s ease-out ${index * 0.05}s both` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`badge border ${similarityColor(item.similarity)}`}>
                          {similarityLabel(item.similarity)} 相似
                        </span>
                        <span className="chip bg-bg-lighter text-gray-400 border-bg-border border">
                          v{item.version}
                        </span>
                        <span className={`badge border ${getRatingColor(item.rating)}`}>
                          {item.rating.toFixed(1)} 分
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-100 mb-1">{item.title}</h4>
                      <div className="relative h-2 bg-bg-border rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                            item.similarity >= 0.9 ? 'bg-status-danger' :
                            item.similarity >= 0.7 ? 'bg-status-warning' : 'bg-status-info'
                          )}
                          style={{ width: `${item.similarity * 100}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleNavigateTo(item.promptId)}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-brand-amber hover:bg-brand-amber/10 rounded-md transition-colors flex-shrink-0"
                    >
                      查看
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-bg-border">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          {result?.hasDuplicate && (
            <button onClick={handleContinue} className="btn-primary">
              <Plus className="w-4 h-4" />
              继续录入
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
