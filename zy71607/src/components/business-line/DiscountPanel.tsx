import type { DiscountCalculation } from '@/types'
import { Percent, AlertTriangle, CheckCircle } from 'lucide-react'

interface DiscountPanelProps {
  discount: DiscountCalculation
}

export default function DiscountPanel({ discount }: DiscountPanelProps) {
  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
          <Percent className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <h3 className="text-sm font-medium text-surface-200">折扣计算</h3>
        {discount.isCorrect ? (
          <span className="px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green text-[10px] font-medium">
            计算正确
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange text-[10px] font-medium">
            折扣误套
          </span>
        )}
      </div>

      <div className="space-y-2">
        {discount.steps.map((step, index) => (
          <div
            key={index}
            className={`rounded-lg border px-3 py-2.5 ${
              index === discount.steps.length - 1 && !discount.isCorrect
                ? 'bg-accent-orange/5 border-accent-orange/30'
                : index === discount.steps.length - 1
                ? 'bg-accent-green/5 border-accent-green/20'
                : 'bg-surface-700/40 border-surface-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {index === discount.steps.length - 1 ? (
                  discount.isCorrect ? (
                    <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-accent-orange" />
                  )
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-surface-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-500" />
                  </div>
                )}
                <span className="text-xs text-surface-200">{step.label}</span>
              </div>
              <span className="text-sm text-surface-100 font-mono font-medium">
                {step.coefficient}
              </span>
            </div>
            <p className="text-[10px] text-surface-400 mt-1 ml-5.5">{step.source}</p>
          </div>
        ))}
      </div>

      {!discount.isCorrect && discount.errorReason && (
        <div className="mt-3 bg-accent-orange/10 border border-accent-orange/20 rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-accent-orange mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-accent-orange leading-relaxed">
              {discount.errorReason}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
