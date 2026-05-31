import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Lightbulb } from 'lucide-react';
import type { ProofreadIssue } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface IssueCardProps {
  issue: ProofreadIssue;
}

const issueConfig = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    label: '错误',
    labelBg: 'bg-red-100 text-red-700',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
    label: '提醒',
    labelBg: 'bg-amber-100 text-amber-700',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
    label: '提示',
    labelBg: 'bg-blue-100 text-blue-700',
  },
};

export default function IssueCard({ issue }: IssueCardProps) {
  const { resolveIssue } = useAppStore();
  const config = issueConfig[issue.type];
  const Icon = config.icon;

  const handleResolve = () => {
    if (!issue.resolved) {
      resolveIssue(issue.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden ${
        issue.resolved ? 'opacity-60' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor} ${config.iconColor}`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.labelBg}`}>
                {config.label}
              </span>
              {issue.resolved && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  已解决
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">{issue.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{issue.message}</p>
            
            <div className="flex items-start gap-2 p-3 bg-white/60 rounded-lg">
              <Lightbulb size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-600">
                <span className="font-medium">建议：</span>
                {issue.suggestion}
              </p>
            </div>

            {issue.location && (
              <p className="text-xs text-slate-500 mt-3">
                📍 位置：
                {issue.location.field && `字段: ${issue.location.field}`}
                {issue.location.line && `第 ${issue.location.line} 行`}
              </p>
            )}
          </div>
        </div>

        {!issue.resolved && (
          <div className="mt-4 pt-4 border-t border-slate-200/50">
            <button
              onClick={handleResolve}
              className="w-full py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-200 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              标记为已解决
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
