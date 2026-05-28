import { useState } from 'react';
import {
  Search,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import type { IssueTrack, Correction, IssueStatus } from '../../types';
import { getIssueTypeLabel } from '../../utils/suggestionEngine';
import { usePrintStore } from '../../store/usePrintStore';

interface IssueTimelineProps {
  issues: IssueTrack[];
  corrections: Correction[];
}

const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; icon: typeof Search }> = {
  discovered: { label: '发现问题', color: 'text-orange-400 bg-orange-500/20 border-orange-500/50', icon: Search },
  corrected: { label: '已修正', color: 'text-blue-400 bg-blue-500/20 border-blue-500/50', icon: Wrench },
  confirmed: { label: '已确认', color: 'text-green-400 bg-green-500/20 border-green-500/50', icon: CheckCircle },
};

export const IssueTimeline = ({ issues, corrections }: IssueTimelineProps) => {
  const { addCorrection, confirmCorrection, currentUser } = usePrintStore();
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState<Record<string, string>>({});
  const [confirmNotes, setConfirmNotes] = useState<Record<string, string>>({});

  const getIssueCorrection = (issueId: string) => {
    return corrections.find((c) => c.issueTrackId === issueId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAddCorrection = (issueId: string) => {
    if (!correctionText[issueId]?.trim()) return;

    addCorrection(
      {
        issueTrackId: issueId,
        suggestion: correctionText[issueId],
        adjustedParams: {},
        expectedImprovement: 30,
        correctedBy: currentUser,
      },
      issueId,
    );
    setCorrectionText({ ...correctionText, [issueId]: '' });
  };

  const handleConfirm = (correctionId: string, result: 'pass' | 'fail') => {
    confirmCorrection(correctionId, result, currentUser, confirmNotes[correctionId]);
    setConfirmNotes({ ...confirmNotes, [correctionId]: '' });
  };

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-slate-800/30 rounded-lg border border-slate-700 border-dashed">
        <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
        <div className="text-gray-400">暂无问题记录</div>
        <div className="text-sm text-gray-500">所有参数校验通过</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {issues.map((issue, idx) => {
        const statusConfig = STATUS_CONFIG[issue.status];
        const StatusIcon = statusConfig.icon;
        const correction = getIssueCorrection(issue.id);
        const isExpanded = expandedIssue === issue.id;

        return (
          <div
            key={issue.id}
            className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div
              className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
              onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`p-2 rounded-full border ${statusConfig.color}`}
                >
                  <StatusIcon className="w-4 h-4" />
                </div>
                {idx < issues.length - 1 && (
                  <div className="w-px h-12 bg-slate-600 mt-2" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs border ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                    {getIssueTypeLabel(issue.issueType)}
                  </span>
                  {issue.detailRowId && (
                    <span className="text-xs text-gray-500 font-mono">
                      {issue.detailRowId}
                    </span>
                  )}
                </div>
                <p className="text-gray-300 text-sm">{issue.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {issue.discoveredBy}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(issue.discoveredAt)}
                  </span>
                </div>
              </div>

              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-700/50">
                {correction ? (
                  <div className="mt-4 space-y-3">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-300">修正方案</span>
                      </div>
                      <p className="text-gray-300 text-sm">{correction.suggestion}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>预期改善: {correction.expectedImprovement}%</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {correction.correctedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(correction.correctedAt)}
                        </span>
                      </div>
                    </div>

                    {correction.confirmationResult ? (
                      <div
                        className={`border rounded-lg p-3 ${
                          correction.confirmationResult === 'pass'
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle
                            className={`w-4 h-4 ${
                              correction.confirmationResult === 'pass'
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              correction.confirmationResult === 'pass'
                                ? 'text-green-300'
                                : 'text-red-300'
                            }`}
                          >
                            {correction.confirmationResult === 'pass' ? '验证通过' : '验证失败'}
                          </span>
                        </div>
                        {correction.notes && (
                          <p className="text-gray-300 text-sm">{correction.notes}</p>
                        )}
                        {correction.confirmedBy && (
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {correction.confirmedBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {correction.confirmedAt && formatDate(correction.confirmedAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={confirmNotes[correction.id] || ''}
                          onChange={(e) =>
                            setConfirmNotes({ ...confirmNotes, [correction.id]: e.target.value })
                          }
                          placeholder="输入验证备注..."
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                          rows={2}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirm(correction.id, 'pass');
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            确认通过
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirm(correction.id, 'fail');
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            验证失败
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={correctionText[issue.id] || ''}
                      onChange={(e) =>
                        setCorrectionText({ ...correctionText, [issue.id]: e.target.value })
                      }
                      placeholder="输入修正方案说明..."
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                      rows={3}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddCorrection(issue.id);
                      }}
                      disabled={!correctionText[issue.id]?.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                    >
                      <Wrench className="w-4 h-4" />
                      提交修正方案
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
