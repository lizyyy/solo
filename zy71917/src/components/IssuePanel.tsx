import { useState } from 'react';
import { X, AlertTriangle, AlertCircle, Info, Check, Ban } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { formatTimestamp } from '@/utils/subtitleParser';
import type { AlignmentIssue } from '@/types';

const severityOrder: Record<AlignmentIssue['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const typeLabels: Record<AlignmentIssue['type'], string> = {
  silent_deletion: '静音段误删',
  timeline_drift: '时间轴漂移',
  missing_line: '语种遗漏',
};

const severityIcon: Record<AlignmentIssue['severity'], React.ReactNode> = {
  error: <AlertTriangle className="w-4 h-4 text-[#E94560]" />,
  warning: <AlertCircle className="w-4 h-4 text-[#FF6B35]" />,
  info: <Info className="w-4 h-4 text-[#2EC4B6]" />,
};

const statusColors: Record<AlignmentIssue['status'], string> = {
  open: 'bg-[#E94560] text-white',
  resolved: 'bg-green-600 text-white',
  dismissed: 'bg-gray-600 text-white',
};

const statusLabels: Record<AlignmentIssue['status'], string> = {
  open: '待处理',
  resolved: '已解决',
  dismissed: '已忽略',
};

export default function IssuePanel() {
  const issues = useProjectStore((s) => s.issues);
  const resolveIssue = useProjectStore((s) => s.resolveIssue);
  const dismissIssue = useProjectStore((s) => s.dismissIssue);
  const setRightPanel = useProjectStore((s) => s.setRightPanel);
  const setTimeline = useProjectStore((s) => s.setTimeline);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const sorted = [...issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  function handleJump(issue: AlignmentIssue) {
    setTimeline({ playheadPosition: issue.startTime });
  }

  function handleResolve(issueId: string) {
    if (!resolutionText.trim()) return;
    resolveIssue(issueId, resolutionText.trim(), 'current_user');
    setResolvingId(null);
    setResolutionText('');
  }

  return (
    <div className="h-full flex flex-col bg-[#16213E] border-l border-[#0F3460]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#0F3460]">
        <h2 className="text-sm font-semibold text-white tracking-wide">对齐检测</h2>
        <button
          onClick={() => setRightPanel(null)}
          className="p-1 rounded hover:bg-[#0F3460] text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            暂无检测问题
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {sorted.map((issue) => (
              <div
                key={issue.id}
                onClick={() => handleJump(issue)}
                className="rounded-lg bg-[#1A1A2E] border border-[#0F3460] p-3 cursor-pointer hover:border-[#2EC4B6] transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  {severityIcon[issue.severity]}
                  <span className="text-xs font-medium text-white">
                    {typeLabels[issue.type]}
                  </span>
                  <span
                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[issue.status]}`}
                  >
                    {statusLabels[issue.status]}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-gray-400 mb-1">
                  {formatTimestamp(issue.startTime)} → {formatTimestamp(issue.endTime)}
                </div>

                <p className="text-xs text-gray-300 mb-2">{issue.description}</p>

                {issue.status === 'resolved' && issue.resolution && (
                  <div className="text-[11px] text-green-400 mb-2">
                    解决方案: {issue.resolution}
                  </div>
                )}

                {resolvingId === issue.id && (
                  <div className="mb-2">
                    <input
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="输入解决方案..."
                      className="w-full bg-[#0F3460] text-white text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#2EC4B6] placeholder-gray-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleResolve(issue.id);
                        if (e.key === 'Escape') {
                          setResolvingId(null);
                          setResolutionText('');
                        }
                      }}
                    />
                  </div>
                )}

                {issue.status === 'open' && resolvingId !== issue.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setResolvingId(issue.id);
                      }}
                      className="flex items-center gap-1 text-[11px] text-[#2EC4B6] hover:underline"
                    >
                      <Check className="w-3 h-3" /> 解决
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissIssue(issue.id);
                      }}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300"
                    >
                      <Ban className="w-3 h-3" /> 忽略
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
