import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Minus, Plus, X, GripVertical } from 'lucide-react'
import type { FundAsset } from '@/types'
import { FUND_CATEGORY_LABELS, FUND_CATEGORY_COLORS } from '@/data/funds'

interface FundCardProps {
  fund: FundAsset
  inPortfolio?: boolean
  ratio?: number
  onRemove?: () => void
  onAdjust?: (delta: number) => void
}

export default function FundCard({ fund, inPortfolio, ratio, onRemove, onAdjust }: FundCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: fund.id,
    data: { fundId: fund.id, inPortfolio },
    disabled: inPortfolio,
  })

  const categoryLabel = FUND_CATEGORY_LABELS[fund.category] ?? fund.category
  const categoryColor = FUND_CATEGORY_COLORS[fund.category] ?? '#999'
  const riskPercent = Math.round(fund.riskFactor * 100)

  const dragHandleProps = inPortfolio ? {} : { ...attributes, ...listeners }

  const cardStyle: React.CSSProperties = {
    borderColor: categoryColor,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
  }

  return (
    <div
      ref={inPortfolio ? undefined : setNodeRef}
      style={cardStyle}
      className={`bg-white rounded-xl p-3 border-2 transition-all duration-200 hover:shadow-lg relative flex gap-2 ${
        !inPortfolio ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'shadow-xl scale-105' : ''}`}
    >
      {!inPortfolio && (
        <div
          className="w-6 flex items-center justify-center text-cafe-brown/20 hover:text-cafe-brown/40 shrink-0"
          {...dragHandleProps}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      <div
        className="w-1 rounded-full shrink-0"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-cafe-brown truncate">{fund.name}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full shrink-0 text-white"
            style={{ backgroundColor: categoryColor }}
          >
            {categoryLabel}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-cafe-brown/60 shrink-0">风险</span>
          <div className="flex-1 h-1.5 bg-cafe-latte/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${riskPercent}%`,
                backgroundColor: fund.riskFactor > 0.6 ? '#D32F2F' : fund.riskFactor > 0.3 ? '#FBC02D' : '#388E3C',
              }}
            />
          </div>
          <span className="text-xs text-cafe-brown/60 shrink-0 w-7 text-right">{riskPercent}%</span>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-cafe-brown/50">收益系数 {fund.scoreFactor}</span>
        </div>

        {inPortfolio && ratio != null && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor }}
              />
              <span className="text-sm font-bold text-cafe-brown">
                {(ratio * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="w-6 h-6 flex items-center justify-center rounded-full bg-cafe-latte/50 hover:bg-cafe-latte text-cafe-brown transition-colors"
                onClick={() => onAdjust?.(-0.05)}
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                className="w-6 h-6 flex items-center justify-center rounded-full bg-cafe-latte/50 hover:bg-cafe-latte text-cafe-brown transition-colors"
                onClick={() => onAdjust?.(0.05)}
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                className="w-6 h-6 flex items-center justify-center rounded-full bg-risk-red/10 hover:bg-risk-red/20 text-risk-red transition-colors ml-1"
                onClick={() => onRemove?.()}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {!inPortfolio && (
          <div className="mt-2 text-xs text-center text-cafe-brown/40 py-1 border border-dashed border-cafe-latte rounded-lg pointer-events-none">
            拖入操作台
          </div>
        )}
      </div>
    </div>
  )
}
