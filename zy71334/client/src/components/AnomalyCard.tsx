import { AnomalyRecord } from '../types'
import { getAnomalyTypeColor, getAnomalyIcon, formatDateTime, timeAgo } from '../utils/format'
import { AlertTriangle, Link2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AnomalyCardProps {
  anomaly: AnomalyRecord
  showLink?: boolean
}

export default function AnomalyCard({ anomaly, showLink = true }: AnomalyCardProps) {
  const typeColors: Record<AnomalyRecord['type'], string> = {
    channel_invalid: 'border-accent-red/50 bg-accent-red/5',
    duplicate: 'border-accent-amber/50 bg-accent-amber/5',
    overwrite: 'border-accent-orange/50 bg-accent-orange/5',
  }

  const typeBadgeColors: Record<AnomalyRecord['type'], string> = {
    channel_invalid: 'bg-accent-red/20 text-accent-red border-accent-red/30',
    duplicate: 'bg-accent-amber/20 text-accent-amber border-accent-amber/30',
    overwrite: 'bg-accent-orange/20 text-accent-orange border-accent-orange/30',
  }

  const typeLabels: Record<AnomalyRecord['type'], string> = {
    channel_invalid: '通道错误',
    duplicate: '重复问题',
    overwrite: '覆盖风险',
  }

  return (
    <div className={`rounded-lg border ${typeColors[anomaly.type]} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${getAnomalyTypeColor(anomaly.type)}`} />
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${typeBadgeColors[anomaly.type]}`}>
              {getAnomalyIcon(anomaly.type)}
              {typeLabels[anomaly.type]}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {timeAgo(anomaly.createdAt)} · {formatDateTime(anomaly.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-slate-400 min-w-[4em]">原因：</span>
          <span className="text-slate-200">{anomaly.reason}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-400 min-w-[4em]">影响：</span>
          <span className="text-slate-200">{anomaly.impact}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-accent-green min-w-[4em]">下一步：</span>
          <span className="text-slate-200">{anomaly.nextAction}</span>
        </div>
      </div>

      {anomaly.relatedProblemIds && anomaly.relatedProblemIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stage-border">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
            <Link2 className="w-3 h-3" />
            <span>关联问题</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {anomaly.relatedProblemIds.map((id) => (
              <Link
                key={id}
                to={`/problem/${id}`}
                className="text-xs px-2 py-1 rounded bg-stage-blue hover:bg-stage-border text-slate-300 transition-colors"
              >
                #{id.substring(0, 8)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {showLink && (
        <div className="mt-3 text-right">
          <Link
            to={`/problem/${anomaly.problemId}`}
            className="inline-flex items-center gap-1 text-xs text-accent-amber hover:text-accent-amber/80"
          >
            查看问题详情 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
