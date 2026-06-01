import { User, Clock, AlertTriangle } from "lucide-react"
import type { Scenario } from "@/types"
import { formatTime } from "@/utils"

interface ScenarioCardProps {
  scenario: Scenario
  timeRemaining: number
  stepIndex: number
  totalSteps: number
}

export default function ScenarioCard({
  scenario,
  timeRemaining,
  stepIndex,
  totalSteps,
}: ScenarioCardProps) {
  const isUrgent = timeRemaining <= 5

  return (
    <div className="card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="tag tag-info">第 {stepIndex + 1} 步 / 共 {totalSteps} 步</span>
          {scenario.isBoundaryCase && (
            <span className="tag tag-warning">
              <AlertTriangle className="w-3 h-3 mr-1" />
              边界场景
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-2 font-mono text-xl font-bold ${
            isUrgent ? "text-danger animate-pulse" : "text-slate-300"
          }`}
        >
          <Clock className={`w-5 h-5 ${isUrgent ? "text-danger" : ""}`} />
          {formatTime(timeRemaining)}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm text-slate-400 mb-2">场景背景</div>
        <p className="text-slate-300 prose-like">{scenario.context}</p>
      </div>

      <div className="bg-slate-700/30 rounded-2xl p-6 border border-slate-600/50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-400/20 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <div className="text-sm text-slate-400 mb-1">客户说</div>
            <p className="text-xl font-medium leading-relaxed">
              {scenario.customerMessage}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500 italic">
        评分规则：{scenario.scoringRule}
      </div>
    </div>
  )
}
