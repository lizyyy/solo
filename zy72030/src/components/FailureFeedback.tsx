import { X, AlertCircle, Clock, BookOpen, HelpCircle, UserCheck } from 'lucide-react'
import { cn } from '@/utils'
import type { FailureReason } from '@/types'
import { FAILURE_REASON_LABELS, FAILURE_REASON_COLLEAGUE } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  failureReason: FailureReason | null
  polyhedronType: string
  score: number
  detail: string | null
}

const getFailureIcon = (reason: FailureReason) => {
  switch (reason) {
    case 'rule_misunderstanding':
      return <BookOpen size={32} className="text-red-400" />
    case 'operation_timeout':
      return <Clock size={32} className="text-orange-400" />
    case 'boundary_score':
      return <HelpCircle size={32} className="text-amber-400" />
    case 'other_exception':
      return <AlertCircle size={32} className="text-purple-400" />
  }
}

const getFailureBg = (reason: FailureReason) => {
  switch (reason) {
    case 'rule_misunderstanding':
      return 'from-red-900/50 to-[#16213e] border-red-800'
    case 'operation_timeout':
      return 'from-orange-900/50 to-[#16213e] border-orange-800'
    case 'boundary_score':
      return 'from-amber-900/50 to-[#16213e] border-amber-800'
    case 'other_exception':
      return 'from-purple-900/50 to-[#16213e] border-purple-800'
  }
}

export default function FailureFeedback({
  open,
  onClose,
  failureReason,
  polyhedronType,
  score,
  detail,
}: Props) {
  if (!open || !failureReason) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl border p-8 bg-gradient-to-br shadow-2xl',
          getFailureBg(failureReason)
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex p-4 bg-black/30 rounded-full mb-4">
            {getFailureIcon(failureReason)}
          </div>
          <h3 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            {FAILURE_REASON_LABELS[failureReason]}
          </h3>
          <p className="text-sm text-gray-400">不是笼统的"游戏结束"，得说清楚卡在哪了</p>
        </div>

        <div className="bg-black/30 rounded-xl p-5 mb-5">
          <div className="text-sm text-gray-300 leading-relaxed">
            {detail || FAILURE_REASON_COLLEAGUE[failureReason]}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">多面体类型</span>
            <span className="text-white font-medium">{polyhedronType}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">得分</span>
            <span className="text-[#f0a500] font-mono font-bold">{score}</span>
          </div>
        </div>

        <div className="mt-6 p-3 bg-blue-900/30 border border-blue-700/40 rounded-lg">
          <div className="flex items-start gap-2">
            <UserCheck size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300">
              <strong>同事提醒：</strong>这条记录会被单独标记，不会在汇总时悄悄消失，
              复盘时可以直接拿出来解释给老师听。
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-[#f0a500] hover:bg-[#f5b624] text-[#1a1a2e] rounded-lg font-semibold transition-colors"
        >
          知道了，继续
        </button>
      </div>
    </div>
  )
}
