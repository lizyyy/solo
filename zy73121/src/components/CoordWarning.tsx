import { AlertTriangle, PauseCircle, CheckCircle2 } from 'lucide-react'
import { detectCoordReversal } from '@/utils/coordCheck'
import { cn } from '@/lib/utils'
import type { RecordStatus } from '@/utils/types'

interface CoordWarningProps {
  lat: number
  lng: number
  status: RecordStatus
  onSuspend: () => void
  onConfirm: () => void
}

export default function CoordWarning({ lat, lng, status, onSuspend, onConfirm }: CoordWarningProps) {
  const check = detectCoordReversal(lat, lng)

  if (!check.reversed && status !== 'SUSPENDED') {
    return null
  }

  const isSuspended = status === 'SUSPENDED'

  return (
    <div
      className={cn(
        'rounded-xl p-4 mb-6 border transition-all duration-300',
        isSuspended ? 'bg-alert/20 border-alert/40' : 'bg-alert/10 border-alert/30'
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-lg flex-shrink-0',
            isSuspended ? 'bg-alert/30 animate-pulse-slow' : 'bg-alert/20'
          )}>
            <AlertTriangle className="w-5 h-5 text-alert" />
          </div>
          <div>
            <h4 className="font-semibold text-alert font-display">
              {isSuspended ? '已挂起 - 经纬度疑似反写' : '经纬度疑似反写'}
            </h4>
            <p className="text-sm text-surface/80 mt-1">
              {check.reason || '该记录已被标记为挂起待确认状态'}
            </p>
            <p className="text-xs text-muted mt-1">
              检测值：纬度 {lat.toFixed(4)}°, 经度 {lng.toFixed(4)}°
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuspended ? (
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon text-ocean-950 font-semibold hover:bg-neon/90 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              接手确认
            </button>
          ) : (
            <button
              onClick={onSuspend}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-alert text-white font-semibold hover:bg-alert/90 transition-all animate-pulse-alert"
            >
              <PauseCircle className="w-4 h-4" />
              挂起待确认
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
