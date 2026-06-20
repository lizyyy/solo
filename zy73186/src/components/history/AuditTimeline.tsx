import React, { useState } from 'react';
import { Edit3, Upload, Calculator, FileText, Trash2, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditLog } from '@/types';
import { ACTION_TYPE_LABELS } from '@/types';
import { shortHash } from '@/utils/hash';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';

interface AuditTimelineProps {
  logs: AuditLog[];
  sessionId?: string;
  onViewDiff?: (logId: string) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  material_upload: <Upload className="w-3.5 h-3.5" />,
  material_update: <Edit3 className="w-3.5 h-3.5" />,
  material_delete: <Trash2 className="w-3.5 h-3.5" />,
  computation_start: <Calculator className="w-3.5 h-3.5" />,
  computation_complete: <Calculator className="w-3.5 h-3.5" />,
  manual_edit: <Edit3 className="w-3.5 h-3.5" />,
  report_generate: <FileText className="w-3.5 h-3.5" />,
  session_transfer: <Users className="w-3.5 h-3.5" />,
  caliber_change_detected: <AlertTriangle className="w-3.5 h-3.5" />,
  suspended_resolved: <RefreshCw className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  material_upload: 'bg-[#3182ce]',
  material_update: 'bg-[#dd6b20]',
  material_delete: 'bg-[#c53030]',
  computation_start: 'bg-[#805ad5]',
  computation_complete: 'bg-[#38a169]',
  manual_edit: 'bg-[#c53030]',
  report_generate: 'bg-[#68d391]',
  session_transfer: 'bg-[#d53f8c]',
  caliber_change_detected: 'bg-[#dd6b20]',
  suspended_resolved: 'bg-[#38a169]',
};

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  logs,
  sessionId,
  onViewDiff,
}) => {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredLogs = sessionId
    ? logs.filter((l) => l.sessionId === sessionId)
    : logs;

  const displayLogs = filter === 'all'
    ? filteredLogs
    : filteredLogs.filter((l) => l.actionType === filter);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const actionTypes = Array.from(new Set(filteredLogs.map((l) => l.actionType)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm text-[#e2e8f0] tracking-wide">操作审计</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={filter === 'all' ? 'primary' : 'ghost'}
            onClick={() => setFilter('all')}
          >
            全部
          </Button>
          {actionTypes.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={filter === type ? 'primary' : 'ghost'}
              onClick={() => setFilter(type)}
            >
              {ACTION_TYPE_LABELS[type as keyof typeof ACTION_TYPE_LABELS] || type}
            </Button>
          ))}
        </div>
      </div>

      {displayLogs.length === 0 ? (
        <div className="py-8 text-center text-[#718096] font-mono text-sm">
          暂无审计记录
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[#4a5568]" />

          <div className="space-y-4">
            {displayLogs.map((log) => (
              <div key={log.id} className="relative pl-10">
                <div
                  className={cn(
                    'absolute left-2.5 w-3 h-3 rounded-full z-10 flex items-center justify-center text-white',
                    ACTION_COLORS[log.actionType] || 'bg-[#718096]'
                  )}
                >
                  {ACTION_ICONS[log.actionType]}
                </div>

                <div className="p-4 bg-[#1a202c] border border-[#4a5568] rounded-lg hover:border-[#3182ce] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[#e2e8f0]">
                          {ACTION_TYPE_LABELS[log.actionType as keyof typeof ACTION_TYPE_LABELS] || log.actionType}
                        </span>
                        {log.manualEdit && (
                          <span className="px-1.5 py-0.5 text-xs bg-[#c53030]/20 text-[#fc8181] rounded">
                            人工修改
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs font-mono text-[#718096]">
                        <span>{formatTime(log.timestamp)}</span>
                        <span>·</span>
                        <span>{log.operator}</span>
                        {log.sessionId && (
                          <>
                            <span>·</span>
                            <span className="text-[#a0aec0]">#{shortHash(log.sessionId, 6)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {log.diff && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                      >
                        查看变更
                      </Button>
                    )}
                  </div>

                  <p className="text-sm text-[#a0aec0]">{log.description}</p>

                  {log.manualEdit && (
                    <div className="mt-3 p-3 bg-[#c53030]/10 border border-[#c53030]/30 rounded">
                      <div className="text-xs font-mono text-[#fc8181] mb-1">修改原因</div>
                      <p className="text-sm text-[#a0aec0]">{log.manualEdit.reason}</p>
                    </div>
                  )}

                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#4a5568]">
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <div key={key} className="text-[#718096]">
                            {key}: <span className="text-[#a0aec0]">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="变更详情"
        size="lg"
      >
        {selectedLog?.diff && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-[#718096] mb-2">变更前</div>
              <pre className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono text-[#a0aec0] overflow-auto">
                {JSON.stringify(selectedLog.diff.before, null, 2)}
              </pre>
            </div>
            <div>
              <div className="text-xs font-mono text-[#718096] mb-2">变更后</div>
              <pre className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono text-[#a0aec0] overflow-auto">
                {JSON.stringify(selectedLog.diff.after, null, 2)}
              </pre>
            </div>
            {selectedLog.diff.changeSummary && (
              <div>
                <div className="text-xs font-mono text-[#718096] mb-2">变更摘要</div>
                <div className="p-3 bg-[#1a202c] rounded border border-[#4a5568]">
                  {selectedLog.diff.changeSummary.map((change, i) => (
                    <div key={i} className="text-sm text-[#a0aec0] mb-1 last:mb-0">
                      • {typeof change === 'string' ? change : `${change.field}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
