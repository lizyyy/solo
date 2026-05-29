import { ColorIssue } from '@/types';
import { getIssueTypeLabel, getSeverityLabel, getSeverityColor } from '@/lib/colorAnalyzer';
import { cn } from '@/lib/utils';
import { AlertTriangle, X, Zap } from 'lucide-react';

interface IssueTableProps {
  issues: ColorIssue[];
  onIssueClick?: (issue: ColorIssue) => void;
  selectedIssueId?: string;
  className?: string;
}

const issueIcons = {
  duplicate: Zap,
  gray: AlertTriangle,
  over_saturated: X
};

export function IssueTable({ issues, onIssueClick, selectedIssueId, className }: IssueTableProps) {
  if (issues.length === 0) {
    return (
      <div className={cn(
        'bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center',
        className
      )}>
        <div className="text-emerald-500 mb-2">✓</div>
        <p className="text-emerald-700 font-medium">未检测到色彩问题</p>
        <p className="text-emerald-600 text-sm mt-1">配色质量良好</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-medium text-slate-600">问题类型</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">严重程度</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">颜色</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">占比</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">位置</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">说明</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => {
            const Icon = issueIcons[issue.type] || AlertTriangle;
            const severityColor = getSeverityColor(issue.severity);

            return (
              <tr
                key={issue.id}
                className={cn(
                  'border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors',
                  selectedIssueId === issue.id && 'bg-indigo-50',
                  index % 2 === 0 && 'bg-white',
                  index % 2 === 1 && 'bg-slate-50/50'
                )}
                onClick={() => onIssueClick?.(issue)}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: severityColor }} />
                    <span className="font-medium">{getIssueTypeLabel(issue.type)}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: severityColor + '20',
                      color: severityColor
                    }}
                  >
                    {getSeverityLabel(issue.severity)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border border-slate-200"
                      style={{ backgroundColor: issue.colorHex }}
                    />
                    <span className="font-mono text-xs">{issue.colorHex.toUpperCase()}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono">{issue.percentage.toFixed(1)}%</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-500">
                  ({issue.pos_x}, {issue.pos_y})
                </td>
                <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                  {issue.description}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
