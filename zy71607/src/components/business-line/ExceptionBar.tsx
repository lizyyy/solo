import type { ExceptionType } from '@/types'
import { EXCEPTION_LABELS } from '@/types'
import { useRenewalStore } from '@/store/useRenewalStore'
import { AlertTriangle, SkipForward, CheckCircle, X } from 'lucide-react'

const EXCEPTION_ICONS: Record<ExceptionType, string> = {
  claim_missing: '📋',
  discount_error: '💰',
  quote_overwrite: '📄',
  channel_conflict: '🔀',
}

const EXCEPTION_DESCRIPTIONS: Record<ExceptionType, string> = {
  claim_missing: '出险记录未完全录入系统，可能导致NCD系数偏低',
  discount_error: '折扣系数计算有误，渠道折扣叠加方式不正确',
  quote_overwrite: '报价版本被覆盖，历史报价记录可能不完整',
  channel_conflict: '不同渠道的折扣规则存在冲突',
}

const EXCEPTION_SUGGESTIONS: Record<ExceptionType, string> = {
  claim_missing: '联系理赔部门同步出险记录，更新NCD系数后重新报价',
  discount_error: '核实渠道折扣规则，修正折扣系数后重新计算报价',
  quote_overwrite: '确认最终报价版本，保留历史版本记录',
  channel_conflict: '与渠道经理确认适用的折扣规则',
}

interface ExceptionBarProps {
  taskId: string
  exceptionTypes: ExceptionType[]
  onClose: () => void
}

export default function ExceptionBar({ taskId, exceptionTypes, onClose }: ExceptionBarProps) {
  const { skipException, resolveException } = useRenewalStore()

  if (exceptionTypes.length === 0) return null

  return (
    <div className="bg-surface-800 rounded-xl border border-accent-orange/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-orange" />
          <h3 className="text-sm font-medium text-accent-orange">异常处理</h3>
          <span className="px-2 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange text-[10px] font-medium">
            {exceptionTypes.length}项异常
          </span>
        </div>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {exceptionTypes.map((type) => (
          <div key={type} className="bg-surface-700/40 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{EXCEPTION_ICONS[type]}</span>
              <span className="text-xs text-surface-200 font-medium">
                {EXCEPTION_LABELS[type]}
              </span>
            </div>
            <p className="text-[11px] text-surface-300 mb-1.5 leading-relaxed">
              {EXCEPTION_DESCRIPTIONS[type]}
            </p>
            <p className="text-[11px] text-accent-blue mb-3 leading-relaxed">
              建议：{EXCEPTION_SUGGESTIONS[type]}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => skipException(taskId, type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-600/50 text-xs text-surface-300 hover:bg-surface-600 hover:text-surface-100 transition-colors"
              >
                <SkipForward className="w-3 h-3" />
                <span>跳过</span>
              </button>
              <button
                onClick={() => resolveException(taskId, type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/15 text-xs text-accent-green hover:bg-accent-green/25 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                <span>标记已处理</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
