import { useState } from 'react';
import { Issue } from '@/types';
import { IssueBadge } from './IssueBadge';
import { SEVERITY_LABELS, SEVERITY_COLORS } from '@/constants/purposeCodes';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
} from 'lucide-react';
import { useBusinessStore } from '@/store/businessStore';

interface IssueCardProps {
  issue: Issue;
  businessId: string;
}

export const IssueCard = ({ issue, businessId }: IssueCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const { resolveIssue, ignoreIssue, currentUser } = useBusinessStore();

  const isOpen = issue.status === 'open';
  const canModify = currentUser.role !== 'auditor' && isOpen;

  const handleResolve = () => {
    if (resolution.trim()) {
      resolveIssue(businessId, issue.id, resolution);
      setResolution('');
      setShowResolve(false);
    }
  };

  const statusConfig = {
    open: { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-200', label: '待处理' },
    resolved: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200', label: '已解决' },
    ignored: { icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', label: '已忽略' },
  };

  const config = statusConfig[issue.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all duration-300 ${config.bg} ${isOpen ? 'ring-1 ring-rose-300' : ''}`}
    >
      <div
        className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <StatusIcon className={`mt-0.5 flex-shrink-0 ${config.color}`} size={20} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <IssueBadge type={issue.type} />
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[issue.severity]}`}>
                  {SEVERITY_LABELS[issue.severity]}风险
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color} bg-white`}>
                  {config.label}
                </span>
                {issue.detectedBy === 'system' && (
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                    系统识别
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700">{issue.description}</p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="flex-shrink-0 text-slate-400" size={20} />
          ) : (
            <ChevronDown className="flex-shrink-0 text-slate-400" size={20} />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-inherit px-4 py-3 bg-white">
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              发现时间: {new Date(issue.detectedAt).toLocaleString('zh-CN')}
            </div>
            <div className="flex items-center gap-1">
              <User size={12} />
              {issue.detectedBy === 'system' ? '系统自动识别' : `人工标注: ${issue.resolver || '未知'}`}
            </div>
          </div>

          {issue.status !== 'open' && (
            <div className="mt-2 p-3 rounded bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <User size={12} />
                {issue.resolver}
                <Clock size={12} />
                {issue.resolvedAt && new Date(issue.resolvedAt).toLocaleString('zh-CN')}
              </div>
              <p className="text-sm text-slate-700">{issue.resolution}</p>
            </div>
          )}

          {canModify && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowResolve(!showResolve);
                  }}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                >
                  标记解决
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('确定要忽略此问题吗？')) {
                      ignoreIssue(businessId, issue.id);
                    }
                  }}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                >
                  忽略问题
                </button>
              </div>

              {showResolve && (
                <div className="space-y-2">
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="请输入解决方案说明..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowResolve(false);
                      }}
                      className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve();
                      }}
                      disabled={!resolution.trim()}
                      className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      确认解决
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
