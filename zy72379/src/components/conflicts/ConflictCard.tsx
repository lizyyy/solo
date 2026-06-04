import React, { useState } from 'react';
import { AlertTriangle, Check, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { EvidenceConflict, ConflictResolutionStatus } from '@/types';
import { useCleaningStore } from '@/store/useCleaningStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConflictCompare } from './ConflictCompare';
import { getConflictTypeDescription } from '@/utils/conflictDetector';

interface ConflictCardProps {
  conflict: EvidenceConflict;
  record?: { id: string; materialName: string };
}

export const ConflictCard: React.FC<ConflictCardProps> = ({ conflict, record }) => {
  const { resolveConflict } = useCleaningStore();
  const [expanded, setExpanded] = useState(conflict.resolutionStatus === 'pending');
  const [showActions, setShowActions] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [operatorName, setOperatorName] = useState('林老师');

  const handleResolve = (status: ConflictResolutionStatus) => {
    resolveConflict(conflict.id, status, operatorName, resolutionNote);
    setShowActions(false);
    setResolutionNote('');
  };

  const isPending = conflict.resolutionStatus === 'pending';

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
          <AlertTriangle className={`w-5 h-5 ${isPending ? 'text-warning-600 animate-pulse-slow' : 'text-neutral-400'}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">
                {getConflictTypeDescription(conflict.conflictType)}
              </span>
              <StatusBadge status={conflict.resolutionStatus} type="conflict" size="sm" />
            </div>
            {record && (
              <div className="text-sm text-neutral-500">
                记录 {record.id} · {record.materialName}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && !showActions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(true);
              }}
              className="px-3 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              开始裁决
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
          <ConflictCompare conflict={conflict} />

          {showActions && isPending && (
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-primary-800">请林老师选择裁决结果</span>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-neutral-700 mb-1">裁决人</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-neutral-700 mb-1">裁决备注（可选）</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入裁决说明..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleResolve('accept_photo')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  采信照片
                </button>
                <button
                  onClick={() => handleResolve('accept_note')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  采信备注
                </button>
                <button
                  onClick={() => handleResolve('rejected')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-danger-500 text-white rounded-lg hover:bg-danger-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                  驳回待重审
                </button>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                }}
                className="w-full py-2 text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
