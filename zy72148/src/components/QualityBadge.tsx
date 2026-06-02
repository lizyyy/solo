import { AlertTriangle, Copy, Info } from 'lucide-react';
import type { DataQualityIssue } from '@/types';

interface QualityBadgeProps {
  issues: DataQualityIssue[];
  showTooltip?: boolean;
}

const issueConfig = {
  empty: {
    icon: AlertTriangle,
    bgClass: 'bg-warning-100',
    textClass: 'text-warning-700',
    borderClass: 'border border-warning-500',
  },
  duplicate: {
    icon: Copy,
    bgClass: 'bg-error-100',
    textClass: 'text-error-700',
    borderClass: 'border-2 border-error-500',
  },
  boundary: {
    icon: Info,
    bgClass: 'bg-info-100',
    textClass: 'text-info-700',
    borderClass: 'border border-info-500',
  },
};

export const QualityBadge = ({ issues, showTooltip = true }: QualityBadgeProps) => {
  if (issues.length === 0) return null;

  const uniqueTypes = [...new Set(issues.map(i => i.type))];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {uniqueTypes.map(type => {
        const config = issueConfig[type];
        const Icon = config.icon;
        const typeIssues = issues.filter(i => i.type === type);

        return (
          <div
            key={type}
            className={`group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}`}
          >
            <Icon className="w-3 h-3" />
            <span>{typeIssues.length}</span>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {typeIssues[0].message}
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 mx-auto" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const getRowQualityClass = (issues: DataQualityIssue[]): string => {
  if (issues.some(i => i.type === 'duplicate')) {
    return 'bg-error-50 border-l-4 border-l-error-500';
  }
  if (issues.some(i => i.type === 'empty')) {
    return 'bg-warning-50';
  }
  if (issues.some(i => i.type === 'boundary')) {
    return 'relative';
  }
  return '';
};
