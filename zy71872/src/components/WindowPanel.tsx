import { Users } from 'lucide-react';
import type { Window as WindowType, Submission } from '../types';
import { StatusBadge } from './StatusBadge';

interface WindowPanelProps {
  window: WindowType;
  submissions: Submission[];
}

export function WindowPanel({ window, submissions }: WindowPanelProps) {
  const currentSubmission = submissions.find((s) => s.id === window.currentSubmissionId);
  const queuedSubmissions = window.queue
    .map((id) => submissions.find((s) => s.id === id))
    .filter(Boolean) as Submission[];

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{window.name}</h3>
        <StatusBadge status={window.status} size="sm" />
      </div>

      {currentSubmission ? (
        <div className="mb-3 p-3 bg-slate-800/50 rounded border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-400">{currentSubmission.teamName}</span>
            <StatusBadge status={currentSubmission.status} size="sm" />
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>材料: {currentSubmission.materials.length} 份</div>
            {currentSubmission.anomalies.length > 0 && (
              <div className="text-amber-400">异常: {currentSubmission.anomalies.length} 个</div>
            )}
            {currentSubmission.isResubmission && (
              <div className="text-blue-400">⚠️ 二次提交</div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-3 p-3 border border-dashed border-slate-700 rounded text-center text-sm text-slate-500">
          等待分配
        </div>
      )}

      {queuedSubmissions.length > 0 && (
        <div>
          <div className="flex items-center space-x-1 text-xs text-slate-400 mb-2">
            <Users className="w-3 h-3" />
            <span>排队中 ({queuedSubmissions.length})</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {queuedSubmissions.map((sub, idx) => (
              <div
                key={sub.id}
                className="flex items-center justify-between px-2 py-1.5 bg-slate-800/30 rounded text-xs"
              >
                <span className="text-slate-300">
                  {idx + 1}. {sub.teamName}
                </span>
                {sub.anomalies.length > 0 && (
                  <span className="text-amber-400">!{sub.anomalies.length}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
