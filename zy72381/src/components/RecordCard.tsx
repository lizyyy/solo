import { Thermometer, ArrowRightLeft, Clock, AlertTriangle, History, Zap } from 'lucide-react'
import type { TemperatureRecord } from '@/types'
import { getStatusLabel, getStatusColor } from '@/utils/calibration'
import { formatTemperature, formatTempDiff, formatDateTime } from '@/utils/formatters'
import { formatEstimationValue } from '@/utils/estimation'
import { clsx } from 'clsx'

interface RecordCardProps {
  record: TemperatureRecord
  onSelect: (id: string) => void
  isSelected: boolean
}

export function RecordCard({ record, onSelect, isSelected }: RecordCardProps) {
  const statusColor = getStatusColor(record.status)
  const isPendingReview = record.status === 'pending_review'
  const isSupplemented = record.status === 'supplemented' || record.oldCalibrationData

  return (
    <div
      onClick={() => onSelect(record.id)}
      className={clsx(
        'bg-industrial-800 rounded-lg p-5 cursor-pointer transition-all duration-200 card-shadow hover-lift',
        isSelected && 'ring-2 ring-supplement-500',
        isPendingReview && 'border-2 border-warning-500/50',
        isSupplemented && 'border-l-4 border-supplement-500'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-industrial-100">{record.recordNo}</h3>
            <span className={`status-badge ${statusColor} text-white`}>
              {getStatusLabel(record.status)}
            </span>
          </div>
          <p className="text-xs text-industrial-500 mt-1">
            {formatDateTime(record.createdAt)}
          </p>
        </div>
        <div className="flex gap-1">
          {isPendingReview && (
            <div className="p-2 bg-warning-500/20 rounded animate-breathing">
              <AlertTriangle className="w-4 h-4 text-warning-500" />
            </div>
          )}
          {isSupplemented && (
            <div className="p-2 bg-supplement-500/20 rounded">
              <History className="w-4 h-4 text-supplement-500" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-industrial-400">
            <Thermometer className="w-4 h-4" />
            <span className="text-xs">温度变化</span>
          </div>
          <div className="text-lg font-semibold text-industrial-100">
            {formatTemperature(record.startTemp)} → {formatTemperature(record.endTemp)}
          </div>
          <div className="text-sm text-industrial-400">
            温差: {formatTempDiff(record.tempDiff)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-industrial-400">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="text-xs">方向标记</span>
          </div>
          <div
            className={clsx(
              'text-lg font-semibold',
              isPendingReview ? 'text-warning-400' : 'text-industrial-100'
            )}
          >
            {record.directionMark}
          </div>
          {isPendingReview && (
            <div className="text-xs text-warning-500">
              需实验老师复核
            </div>
          )}
        </div>
      </div>

      {record.estimatedValue !== undefined && (
        <div className="bg-industrial-900/50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-industrial-400">
              <Zap className="w-4 h-4" />
              <span className="text-sm">估算伸缩量</span>
            </div>
            <span
              className={clsx(
                'font-bold text-lg',
                record.estimatedValue >= 0 ? 'text-success-400' : 'text-warning-400'
              )}
            >
              {formatEstimationValue(record.estimatedValue)}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-industrial-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{record.operationHistory.length} 次操作</span>
        </div>
        <div>
          {record.sensorId ? (
            <span className="text-industrial-400">{record.sensorId}</span>
          ) : (
            <span className="text-warning-500">未关联传感器</span>
          )}
        </div>
      </div>
    </div>
  )
}
