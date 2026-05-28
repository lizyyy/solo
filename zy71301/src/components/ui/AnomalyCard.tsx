import { Clock, AlertTriangle, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { AnomalyEvent } from '@/types';
import { getRiskLevel, getAnomalyTypeInfo, getReviewStatusInfo } from '@/services/riskScoring';
import { useSessionStore } from '@/store/sessionStore';
import { cn } from '@/lib/utils';

interface AnomalyCardProps {
  anomaly: AnomalyEvent;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export default function AnomalyCard({ anomaly, selected, onClick, compact = false }: AnomalyCardProps) {
  const { updateAnomalyReview } = useSessionStore();
  const riskInfo = getRiskLevel(anomaly.riskScore);
  const typeInfo = getAnomalyTypeInfo(anomaly.type);
  const reviewInfo = getReviewStatusInfo(anomaly.reviewStatus);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          'p-3 rounded-lg border cursor-pointer transition-all',
          selected
            ? 'bg-primary-500/20 border-primary-500/50'
            : 'bg-dark-700/50 border-dark-600 hover:border-dark-500'
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', getSeverityColor(anomaly.severity))} />
            <span className="text-sm font-medium text-white">{typeInfo.label}</span>
          </div>
          <span className={cn('text-sm font-bold', riskInfo.color)}>{anomaly.riskScore}</span>
        </div>
        <div className="mt-1 text-xs text-dark-400">
          {anomaly.startTime.toFixed(1)}s - {anomaly.endTime.toFixed(1)}s
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-xl border cursor-pointer transition-all card-hover',
        selected
          ? 'bg-primary-500/20 border-primary-500/50 shadow-lg shadow-primary-500/10'
          : 'bg-dark-700/50 border-dark-600 hover:border-dark-500'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              riskInfo.bgColor
            )}
          >
            <AlertTriangle className={cn('w-6 h-6', riskInfo.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{typeInfo.label}</h4>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  reviewInfo.bgColor,
                  reviewInfo.color
                )}
              >
                {reviewInfo.label}
              </span>
            </div>
            <p className="text-sm text-dark-400 mt-0.5">{typeInfo.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-2xl font-display font-bold', riskInfo.color)}>
            {anomaly.riskScore}
          </div>
          <div className="text-xs text-dark-400">风险评分</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-dark-800/50 rounded-lg p-2">
          <div className="text-xs text-dark-400">峰值加速度</div>
          <div className="text-sm font-semibold text-white mt-0.5">
            {anomaly.peakAcceleration.toFixed(2)} m/s²
          </div>
        </div>
        <div className="bg-dark-800/50 rounded-lg p-2">
          <div className="text-xs text-dark-400">持续时间</div>
          <div className="text-sm font-semibold text-white mt-0.5">
            {anomaly.duration.toFixed(2)}s
          </div>
        </div>
        <div className="bg-dark-800/50 rounded-lg p-2">
          <div className="text-xs text-dark-400">主导轴</div>
          <div className="text-sm font-semibold text-white mt-0.5">{anomaly.dominantAxis.toUpperCase()}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <Clock className="w-3 h-3" />
          <span>
            {anomaly.startTime.toFixed(1)}s - {anomaly.endTime.toFixed(1)}s
          </span>
          <span className="mx-1">•</span>
          <span>置信度 {(anomaly.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-2">
          {anomaly.reviewStatus === 'pending' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateAnomalyReview(anomaly.id, 'confirmed');
                }}
                className="p-1.5 rounded-lg bg-success-500/20 text-success-400 hover:bg-success-500/30 transition-colors"
                title="标记为确认"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateAnomalyReview(anomaly.id, 'false_positive');
                }}
                className="p-1.5 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                title="标记为误报"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          <ChevronRight className="w-4 h-4 text-dark-400" />
        </div>
      </div>
    </div>
  );
}
