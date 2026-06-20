import React from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import type { Session } from '@/types';
import { STATUS_LABELS } from '@/types';
import { shortHash } from '@/utils/hash';

interface ProgressBarProps {
  session: Session | null;
  lastSaveTime: number;
  isSaving: boolean;
  totalSteps: number;
  currentStep: number;
  onSave: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  session,
  lastSaveTime,
  isSaving,
  totalSteps,
  currentStep,
  onSave,
}) => {
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '未保存';
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-[#4a5568]">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="font-mono text-sm text-[#a0aec0]">
              会话 <span className="text-[#e2e8f0]">#{session ? shortHash(session.id, 8) : '---'}</span>
            </div>
            {session?.status && (
              <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[#1a202c] border border-[#4a5568]">
                {session.status === 'suspended' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#dd6b20]" />
                ) : session.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#38a169]" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full bg-[#4299e1] animate-pulse" />
                )}
                <span className="font-mono text-xs text-[#a0aec0]">
                  {STATUS_LABELS[session.status]}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#a0aec0]">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isSaving ? '保存中...' : `上次保存: ${formatTime(lastSaveTime)}`}
              </span>
            </div>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-[#a0aec0] bg-transparent border border-[#4a5568] rounded hover:bg-[#2d3748] hover:text-white transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              立即保存
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1a365d] to-[#38a169] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="absolute inset-0 flex justify-between px-0.5 mt-1">
            {Array.from({ length: Math.max(totalSteps, 1) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-0.5 h-2 rounded-full transition-colors',
                  i <= currentStep ? 'bg-[#38a169]' : 'bg-[#4a5568]'
                )}
                title={`步骤 ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex justify-between mt-2 text-xs font-mono text-[#718096]">
            <span>步骤 {currentStep + 1} / {totalSteps || 1}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
