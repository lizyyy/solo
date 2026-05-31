import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import type { Submission, Team } from '../types';
import { StatusBadge } from './StatusBadge';
import { AnomalyBadge } from './AnomalyBadge';
import { getMaterialTypeLabel } from '../services/anomalyService';

interface SubmissionCardProps {
  submission: Submission;
  team?: Team;
  showMaterials?: boolean;
}

export function SubmissionCard({ submission, team, showMaterials = true }: SubmissionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="panel">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{submission.teamName}</span>
              {submission.isResubmission && (
                <span className="badge text-blue-400 bg-blue-900/30 border-blue-500/50 text-xs">
                  二次提交
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              ID: {submission.id.substring(0, 16)}...
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {submission.anomalies.length > 0 && (
            <div className="flex -space-x-1">
              {submission.anomalies.slice(0, 3).map((a) => (
                <AnomalyBadge
                  key={a.id}
                  type={a.type}
                  severity={a.severity}
                  showLabel={false}
                />
              ))}
            </div>
          )}
          <StatusBadge status={submission.status} size="sm" />
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-400 text-xs">开始时间</div>
              <div className="font-mono">{formatTime(submission.startTime)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">结束时间</div>
              <div className="font-mono">
                {submission.endTime ? formatTime(submission.endTime) : '-'}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">处理窗口</div>
              <div>{submission.windowId || '未分配'}</div>
            </div>
          </div>

          {showMaterials && (
            <div>
              <div className="text-xs text-slate-400 mb-2 flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span>材料清单 ({submission.materials.length})</span>
              </div>
              <div className="space-y-1">
                {submission.materials.map((material, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-sm ${
                      material.hasIssue
                        ? 'bg-red-900/20 border border-red-800/50'
                        : material.status === 'approved'
                        ? 'bg-emerald-900/20 border border-emerald-800/50'
                        : 'bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          material.hasIssue
                            ? 'bg-red-500'
                            : material.status === 'approved'
                            ? 'bg-emerald-500'
                            : 'bg-slate-500'
                        }`}
                      />
                      <span className="text-slate-300">{material.name}</span>
                      <span className="text-xs text-slate-500">
                        ({getMaterialTypeLabel(material.type)})
                      </span>
                    </div>
                    {material.hasIssue && material.issueDesc && (
                      <span className="text-xs text-red-400">{material.issueDesc}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {submission.anomalies.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">
                异常记录 ({submission.anomalies.length})
              </div>
              <div className="space-y-2">
                {submission.anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className="p-2 rounded border text-sm"
                    style={{
                      borderColor: anomaly.severity === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                                 anomaly.severity === 'warning' ? 'rgba(245, 158, 11, 0.3)' :
                                 'rgba(59, 130, 246, 0.3)',
                      backgroundColor: anomaly.severity === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                                       anomaly.severity === 'warning' ? 'rgba(245, 158, 11, 0.1)' :
                                       'rgba(59, 130, 246, 0.1)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <AnomalyBadge type={anomaly.type} severity={anomaly.severity} />
                      {anomaly.handled && (
                        <span className="text-xs text-emerald-400">已处理</span>
                      )}
                    </div>
                    <div className="text-slate-300 text-xs">{anomaly.message}</div>
                    <div className="text-slate-500 text-xs mt-1">{anomaly.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
