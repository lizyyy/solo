import { useState } from 'react';
import type { TraceLink } from '@/types';
import { cn } from '@/lib/utils';
import {
  Users,
  BarChart3,
  ClipboardList,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  History,
} from 'lucide-react';

interface TraceTimelineProps {
  traceLinks: TraceLink[];
  onLinkClick?: (link: TraceLink) => void;
  selectedLinkId?: string | null;
}

const sourceTypeConfig = {
  team_record: {
    label: '班组记录',
    Icon: Users,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  condition_log: {
    label: '工况日志',
    Icon: BarChart3,
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  threshold: {
    label: '阈值表',
    Icon: ClipboardList,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
};

const impactConfig = {
  positive: {
    label: '正面影响',
    Icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  negative: {
    label: '负面影响',
    Icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  neutral: {
    label: '中性',
    Icon: MinusCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

export default function TraceTimeline({
  traceLinks,
  onLinkClick,
  selectedLinkId,
}: TraceTimelineProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['team_record', 'condition_log', 'threshold'])
  );

  const groupedLinks = traceLinks.reduce((acc, link) => {
    if (!acc[link.sourceType]) {
      acc[link.sourceType] = [];
    }
    acc[link.sourceType].push(link);
    return acc;
  }, {} as Record<string, TraceLink[]>);

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  if (traceLinks.length === 0) {
    return (
      <div className="text-center py-8 text-industrial-500">
        <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>暂无追溯数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedLinks).map(([type, links]) => {
        const config = sourceTypeConfig[type as keyof typeof sourceTypeConfig];
        const Icon = config.Icon;
        const isExpanded = expandedGroups.has(type);

        return (
          <div
            key={type}
            className={cn('border', config.borderColor, config.bgColor)}
          >
            <button
              onClick={() => toggleGroup(type)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-8 h-8 flex items-center justify-center text-white', config.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-industrial-900">
                    {config.label}
                    <span className="ml-2 text-xs text-industrial-500 font-normal">
                      ({links.length} 条记录)
                    </span>
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-industrial-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-industrial-500" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-inherit px-4 py-3 space-y-3">
                {links.map((link) => {
                  const impact = impactConfig[link.impact];
                  const ImpactIcon = impact.Icon;
                  const isSelected = selectedLinkId === link.id;
                  const isModification = link.sourceId.includes('-mod-');

                  return (
                    <div
                      key={link.id}
                      onClick={() => onLinkClick?.(link)}
                      className={cn(
                        'relative pl-6 pb-3 border-l-2 transition-all cursor-pointer',
                        isSelected
                          ? 'border-l-primary-600 bg-white shadow-industrial'
                          : 'border-l-industrial-200 hover:bg-white/50',
                        link.sequence === links.length && 'pb-0'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute -left-2.5 top-0 w-5 h-5 rounded-full flex items-center justify-center',
                          impact.bgColor
                        )}
                      >
                        <ImpactIcon className={cn('w-3 h-3', impact.color)} />
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isModification && (
                              <History className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span className="text-sm font-medium text-industrial-900">
                              {link.sourceName}
                            </span>
                            <span className="text-xs text-industrial-400">
                              #{link.sequence}
                            </span>
                          </div>
                          <p className={cn('text-sm', isModification ? 'text-amber-700 italic' : 'text-industrial-600')}>
                            {link.sourceContent}
                          </p>
                        </div>
                        <span className={cn('text-xs px-2 py-0.5 whitespace-nowrap', impact.bgColor, impact.color)}>
                          {impact.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
