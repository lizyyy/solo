import React from 'react';
import { FileText, AlertTriangle, CheckCircle2, Clock, Edit3, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from '@/types';
import { STATUS_LABELS } from '@/types';
import { shortHash } from '@/utils/hash';
import { StatusBadge } from '@/components/common/StatusBadge';

interface SessionCardProps {
  session: Session;
  materialCount: number;
  stepCount: number;
  hasManualEdits: boolean;
  hasSuspendedTasks: boolean;
  onClick: () => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  materialCount,
  stepCount,
  hasManualEdits,
  hasSuspendedTasks,
  onClick,
}) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-5 bg-[#1a202c] border rounded-lg cursor-pointer transition-all hover:border-[#3182ce] hover:bg-[#1a202c]/80',
        hasSuspendedTasks && 'border-[#dd6b20]',
        !hasSuspendedTasks && !hasManualEdits && 'border-[#4a5568]',
        hasManualEdits && !hasSuspendedTasks && 'border-[#c53030]'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[#e2e8f0] font-semibold">
            #{shortHash(session.id, 8)}
          </div>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex items-center gap-2">
          {hasManualEdits && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-[#c53030]/20 text-[#fc8181] rounded">
              <Edit3 className="w-3 h-3" />
              人工修改
            </span>
          )}
          {hasSuspendedTasks && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-[#dd6b20]/20 text-[#fbd38d] rounded">
              <AlertTriangle className="w-3 h-3" />
              挂起中
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-2 bg-[#0d1117] rounded text-center">
          <div className="font-mono text-lg text-[#63b3ed]">{materialCount}</div>
          <div className="text-xs text-[#718096] mt-0.5">材料</div>
        </div>
        <div className="p-2 bg-[#0d1117] rounded text-center">
          <div className="font-mono text-lg text-[#68d391]">{stepCount}</div>
          <div className="text-xs text-[#718096] mt-0.5">计算步骤</div>
        </div>
        <div className="p-2 bg-[#0d1117] rounded text-center">
          <div className="font-mono text-lg text-[#f6ad55]">
            {session.progress.recoveryPoints}
          </div>
          <div className="text-xs text-[#718096] mt-0.5">还原点</div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs font-mono text-[#718096]">
        <div className="flex items-center gap-2">
          <Hash className="w-3 h-3" />
          <span>进度: {session.currentStep + 1} / {session.progress.totalSteps}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>更新: {formatDate(session.updatedAt)}</span>
        </div>
        {session.progress.lastModifiedBy && (
          <div className="flex items-center gap-2">
            <Edit3 className="w-3 h-3" />
            <span>最后修改: {session.progress.lastModifiedBy}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#4a5568]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#718096]">完成度</span>
          <span className="font-mono text-[#a0aec0]">
            {session.progress.completionPercentage.toFixed(0)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 bg-[#0d1117] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1a365d] to-[#38a169] transition-all"
            style={{ width: `${session.progress.completionPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
