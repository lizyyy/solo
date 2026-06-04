import React, { useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, Wrench, Clock, Calculator } from 'lucide-react';
import type { ThresholdAlert } from '@/types';
import { useCleaningStore } from '@/store/useCleaningStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ReviewActions } from './ReviewActions';

interface ThresholdAlertCardProps {
  alert: ThresholdAlert;
  record?: { id: string; materialName: string };
}

export const ThresholdAlertCard: React.FC<ThresholdAlertCardProps> = ({ alert, record }) => {
  const [expanded, setExpanded] = useState(alert.reviewStatus === 'pending_review');
  const [showReview, setShowReview] = useState(false);

  const isPending = alert.reviewStatus === 'pending_review';

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
      isPending ? 'border-warning-300' : 'border-neutral-200'
    }`}>
      <div
        className={`px-4 py-3 border-b cursor-pointer flex items-center justify-between ${
          isPending ? 'bg-warning-50 border-warning-200' : 'bg-neutral-50 border-neutral-200'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <AlertOctagon className={`w-5 h-5 ${isPending ? 'text-warning-600 animate-pulse-slow' : 'text-neutral-400'}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">超阈值告警</span>
              <StatusBadge status={alert.reviewStatus} type="review" size="sm" />
            </div>
            {record && (
              <div className="text-sm text-neutral-500">
                记录 {record.id} · {record.materialName}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && !showReview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReview(true);
              }}
              className="px-3 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
            >
              <Wrench className="w-4 h-4" />
              开始复核
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-neutral-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-center">
              <div className="text-xs text-danger-600 mb-1">原始值</div>
              <div className="font-mono text-2xl font-bold text-danger-700">
                {alert.originalValue}
              </div>
              <div className="text-xs text-danger-500">{alert.originalUnit}</div>
            </div>
            <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg text-center">
              <div className="text-xs text-warning-600 mb-1">阈值上限</div>
              <div className="font-mono text-2xl font-bold text-warning-700">
                {alert.threshold}
              </div>
              <div className="text-xs text-warning-500">{alert.originalUnit}</div>
            </div>
            <div className="p-3 bg-success-50 border border-success-200 rounded-lg text-center">
              <div className="text-xs text-success-600 mb-1">清洗后值</div>
              <div className="font-mono text-2xl font-bold text-success-700">
                {alert.cleanedValue}
              </div>
              <div className="text-xs text-success-500">{alert.cleanedUnit}</div>
            </div>
          </div>

          <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-primary-600" />
              <span className="font-medium text-primary-800">平均值覆盖说明</span>
            </div>
            <p className="text-sm text-primary-700">
              该记录原始值{alert.originalValue}{alert.originalUnit}超过阈值{alert.threshold}{alert.originalUnit}，
              已使用前后相邻点{alert.neighborIndices.join(', ')}的平均值{alert.cleanedValue}{alert.cleanedUnit}覆盖。
              状态标记为"待复核"，不归为正常，等待维修师傅确认。
            </p>
          </div>

          {alert.reviewedBy && (
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <span className="font-medium text-neutral-700">复核记录</span>
              </div>
              <div className="text-sm text-neutral-600">
                {alert.reviewComment || '已完成复核'}
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                复核人：{alert.reviewedBy} · {alert.reviewTime}
              </div>
            </div>
          )}

          {showReview && isPending && (
            <ReviewActions
              alert={alert}
              onCancel={() => setShowReview(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
