import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertOccludedBannerProps {
  recordId: string
  onReview: (recordId: string) => void
}

export default function AlertOccludedBanner({ recordId, onReview }: AlertOccludedBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3 rounded-lg',
        'bg-warning-50 border border-warning-300'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-warning-500 text-white shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-warning-900">
            移动端截图遮挡告警标签，请施工经理复核
          </p>
          <p className="text-xs text-warning-700 mt-0.5">
            记录ID: {recordId}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onReview(recordId)}
        className={cn(
          'shrink-0 px-4 py-2 rounded text-sm font-medium transition-colors',
          'bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700'
        )}
      >
        复核
      </button>
    </div>
  )
}
