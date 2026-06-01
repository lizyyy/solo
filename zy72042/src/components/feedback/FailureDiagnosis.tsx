import { AlertOctagon, Clock, X } from 'lucide-react'
import type { FailureDiagnosis as FailureDiagnosisType, FailReason } from '@/types'

const CATEGORY_TABS: { key: string; label: string; reasons: FailReason[] }[] = [
  { key: 'rule', label: '规则理解', reasons: ['rule'] },
  { key: 'rhythm', label: '操作节奏', reasons: ['timeout', 'resource'] },
  { key: 'risk', label: '风险控制', reasons: ['risk'] },
]

interface FailureDiagnosisProps {
  diagnosis: FailureDiagnosisType
  onRetry: () => void
  onChangeLevel: () => void
  onPause: () => void
  visible: boolean
}

export default function FailureDiagnosis({
  diagnosis,
  onRetry,
  onChangeLevel,
  onPause,
  visible,
}: FailureDiagnosisProps) {
  if (!visible) return null

  const activeTab = CATEGORY_TABS.find(t => t.reasons.includes(diagnosis.reason))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card-cafe max-w-lg w-full mx-4 p-6 animate-bounce-in relative">
        <button
          className="absolute top-4 right-4 text-cafe-brown/40 hover:text-cafe-brown transition-colors"
          onClick={onPause}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <AlertOctagon className="w-6 h-6 text-risk-red" />
          <h2 className="text-lg font-bold text-cafe-brown font-serif">失败诊断</h2>
        </div>

        <div className="flex gap-2 mb-4">
          {CATEGORY_TABS.map(tab => (
            <span
              key={tab.key}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTab?.key === tab.key
                  ? 'bg-risk-red text-white'
                  : 'bg-cafe-latte/50 text-cafe-brown/60'
              }`}
            >
              {tab.label}
            </span>
          ))}
        </div>

        <div className="space-y-3 mb-4">
          {diagnosis.ruleViolated && (
            <div className="bg-risk-red/10 border border-risk-red/30 rounded-lg p-3">
              <p className="text-sm font-bold text-risk-red">{diagnosis.ruleViolated}</p>
              {diagnosis.ruleExplanation && (
                <p className="text-xs text-risk-red/70 mt-1">{diagnosis.ruleExplanation}</p>
              )}
            </div>
          )}

          {diagnosis.timeRemaining != null && (
            <div className="bg-risk-yellow/10 border border-risk-yellow/30 rounded-lg p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-risk-yellow shrink-0" />
              <span className="text-sm text-risk-yellow">剩余时间: {diagnosis.timeRemaining}秒</span>
            </div>
          )}

          {diagnosis.riskExceeded != null && diagnosis.riskExceeded > 0 && (
            <div className="bg-risk-red/10 border border-risk-red/30 rounded-lg p-3">
              <span className="text-sm font-bold text-risk-red">
                风险超出: +{diagnosis.riskExceeded.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="bg-data-blue/10 border border-data-blue/30 rounded-lg p-3 mb-6">
          <p className="text-sm text-data-blue">{diagnosis.suggestion}</p>
        </div>

        <div className="flex gap-3">
          <button className="btn-primary flex-1" onClick={onRetry}>
            重试本关
          </button>
          <button className="btn-secondary flex-1" onClick={onChangeLevel}>
            换一关
          </button>
          <button className="btn-secondary flex-1" onClick={onPause}>
            暂停休息
          </button>
        </div>
      </div>
    </div>
  )
}
