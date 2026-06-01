import { Check, X, Clock, AlertTriangle } from "lucide-react"
import type { StepResult } from "@/types"
import { formatTime } from "@/utils"
import { cn } from "@/lib/utils"

interface DeductionItemProps {
  step: StepResult
  index: number
}

export default function DeductionItem({ step, index }: DeductionItemProps) {
  return (
    <div
      className={cn(
        "card p-5 animate-slide-in",
        step.isCorrect ? "border-l-4 border-l-success" : "border-l-4 border-l-danger"
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="tag tag-info">第 {index + 1} 题</span>
            {step.isBoundaryCase && (
              <span className="tag tag-warning">
                <AlertTriangle className="w-3 h-3 mr-1" />
                边界场景
              </span>
            )}
            {step.timedOut && (
              <span className="tag tag-danger">
                <Clock className="w-3 h-3 mr-1" />
                超时
              </span>
            )}
          </div>

          <p className="text-slate-300 mb-3 line-clamp-2">
            {step.customerMessage}
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  step.isCorrect ? "bg-success/20" : "bg-danger/20"
                )}
              >
                {step.isCorrect ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <X className="w-3 h-3 text-danger" />
                )}
              </div>
              <div>
                <div className="text-sm text-slate-400">你的选择</div>
                <p
                  className={cn(
                    "text-sm",
                    step.isCorrect ? "text-success" : "text-danger"
                  )}
                >
                  {step.selectedOptionText}
                </p>
              </div>
            </div>

            {!step.isCorrect && (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-success" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">正确答案</div>
                  <p className="text-sm text-success">
                    {step.correctOptionText}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div
            className={cn(
              "text-2xl font-bold",
              step.deduction ? "text-danger" : "text-success"
            )}
          >
            {step.deduction ? `-${step.deduction.points}` : "+20"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            用时 {formatTime(step.timeTaken)} / {formatTime(step.timeLimit)}
          </div>
        </div>
      </div>

      {step.deduction && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="tag tag-danger">{step.deduction.type}</span>
            <span className="text-sm text-slate-300">
              {step.deduction.reason}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
