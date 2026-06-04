import React from 'react';
import { Camera, FileText, AlertTriangle, ArrowRight } from 'lucide-react';
import type { EvidenceConflict } from '@/types';
import { getConflictTypeDescription, getConflictImpactLevel } from '@/utils/conflictDetector';

interface ConflictCompareProps {
  conflict: EvidenceConflict;
  showFull?: boolean;
}

export const ConflictCompare: React.FC<ConflictCompareProps> = ({ conflict, showFull = true }) => {
  const impactLevel = getConflictImpactLevel(conflict);
  const impactColors = {
    high: 'bg-danger-50 border-danger-300 text-danger-700',
    medium: 'bg-warning-50 border-warning-300 text-warning-700',
    low: 'bg-primary-50 border-primary-300 text-primary-700',
  };
  const impactLabels = {
    high: '高影响',
    medium: '中影响',
    low: '低影响',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-danger-50 border border-danger-200 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-danger-800">
              {getConflictTypeDescription(conflict.conflictType)}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${impactColors[impactLevel]}`}>
              {impactLabels[impactLevel]}
            </span>
          </div>
          <p className="text-sm text-danger-700">{conflict.impactDescription}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4 text-primary-600" />
            <span className="font-semibold text-primary-700 text-sm">工况照片证据</span>
          </div>
          <p className="text-sm text-primary-800">{conflict.photoEvidence}</p>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center">
            <ArrowRight className="w-6 h-6 text-neutral-500" />
          </div>
        </div>

        <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-warning-600" />
            <span className="font-semibold text-warning-700 text-sm">手写巡检备注</span>
          </div>
          <p className="text-sm text-warning-800">{conflict.noteEvidence}</p>
        </div>
      </div>

      {showFull && conflict.resolvedBy && (
        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
          <div className="text-sm text-neutral-600">
            <span className="font-medium">裁决结果：</span>
            {conflict.resolutionNote || '已裁决'}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            裁决人：{conflict.resolvedBy} · {conflict.resolutionTime}
          </div>
        </div>
      )}
    </div>
  );
};
