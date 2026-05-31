import { AlertTriangle, Info, XCircle, CheckCircle, X } from 'lucide-react';
import type { IssueItem, IssueSeverity } from '@/types';
import { cn } from '@/lib/utils';

interface IssueCardProps {
  issue: IssueItem;
  onResolve?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onView?: (issue: IssueItem) => void;
  selected?: boolean;
}

const severityConfig: Record<IssueSeverity, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
  iconColor: string;
}> = {
  critical: {
    label: '严重',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  warning: {
    label: '一般',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
  },
  info: {
    label: '提示',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

const statusConfig = {
  pending: { label: '待处理', color: 'bg-slate-100 text-slate-600' },
  resolved: { label: '已修正', color: 'bg-green-100 text-green-600' },
  ignored: { label: '已忽略', color: 'bg-gray-100 text-gray-500' },
};

export default function IssueCard({ issue, onResolve, onIgnore, onView, selected }: IssueCardProps) {
  const config = severityConfig[issue.severity];
  const statusInfo = statusConfig[issue.status];
  const Icon = config.icon;

  return (
    <div
      onClick={() => onView?.(issue)}
      className={cn(
        'bg-white rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer hover:shadow-lg',
        selected ? 'border-orange-500 shadow-lg scale-[1.01]' : 'border-slate-200 hover:border-primary',
        issue.status === 'resolved' && 'opacity-70'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
            config.bgColor,
            config.textColor,
            config.borderColor,
            'border'
          )}>
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </span>
          <span className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
            statusInfo.color
          )}>
            {statusInfo.label}
          </span>
          <span className="text-xs text-slate-400">{issue.category}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-400 mb-1">原文</p>
          <p className="text-sm text-slate-600 line-clamp-2 bg-red-50 p-3 rounded-lg border border-red-100">
            <span className="line-through">{issue.originalText}</span>
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1">建议修改</p>
          <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
            {issue.suggestedText}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1">修正理由</p>
          <p className="text-sm text-slate-500">{issue.reason}</p>
        </div>
      </div>

      {issue.status === 'pending' && (onResolve || onIgnore) && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
          {onResolve && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve(issue.id);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-all hover:scale-[1.02]"
            >
              <CheckCircle className="w-4 h-4" />
              确认修正
            </button>
          )}
          {onIgnore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onIgnore(issue.id);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all hover:scale-[1.02]"
            >
              <X className="w-4 h-4" />
              忽略
            </button>
          )}
        </div>
      )}
    </div>
  );
}
