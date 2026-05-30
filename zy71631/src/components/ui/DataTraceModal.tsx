import { X } from 'lucide-react'
import { formatDateTime } from '@/utils'

interface DataTraceModalProps {
  open: boolean
  onClose: () => void
  title: string
  value: number
  dataSource: string
  measuredAt?: string
  seatId?: string
  frequencyBand?: string
}

export default function DataTraceModal({
  open,
  onClose,
  title,
  value,
  dataSource,
  measuredAt,
  seatId,
  frequencyBand,
}: DataTraceModalProps) {
  if (!open) return null

  const getDataSourceColor = (source: string) => {
    if (source.includes('传感器') || source.includes('sensor')) return 'bg-theater-green text-theater-dark'
    if (source.includes('模拟') || source.includes('simulation')) return 'bg-theater-purple text-theater-dark'
    if (source.includes('人工') || source.includes('manual')) return 'bg-theater-orange text-theater-dark'
    return 'bg-theater-accent text-theater-dark'
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 fade-in">
      <div className="glass-panel rounded-xl w-[420px] shadow-theater">
        <div className="flex items-center justify-between p-4 border-b border-theater-border">
          <h3 className="font-display text-lg text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-theater-border rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center py-4">
            <div className="text-gray-400 text-sm mb-1">数值</div>
            <div className="font-mono text-5xl font-bold text-white">
              {value.toFixed(1)}
              <span className="text-2xl text-gray-400 ml-1">dB</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">数据来源</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDataSourceColor(dataSource)}`}>
                {dataSource}
              </span>
            </div>

            {measuredAt && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">测量时间</span>
                <span className="text-white text-sm font-mono">
                  {formatDateTime(measuredAt)}
                </span>
              </div>
            )}

            {seatId && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">关联座位</span>
                <span className="text-white text-sm font-mono">{seatId}</span>
              </div>
            )}

            {frequencyBand && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">关联频段</span>
                <span className="text-white text-sm font-mono">{frequencyBand}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-theater-border">
            <div className="text-gray-400 text-sm mb-1">溯源说明</div>
            <p className="text-gray-300 text-sm leading-relaxed">
              该数值来源于<span className="text-theater-accent">{dataSource}</span>
              {measuredAt && <>，在<span className="text-theater-accent">{formatDateTime(measuredAt)}</span>时采集</>}。
              如与其他来源存在冲突，系统保留最早录入的值。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
