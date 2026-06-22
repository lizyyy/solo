import { useAppStore } from '@/store/appStore';
import { filterAnomalies, groupAnomaliesByType } from '@/utils/export';
import { ANOMALY_TYPE_LABELS } from '@/types';
import type { AnomalyType, AnomalyRecord } from '@/types';
import { AnomalyTypeTag, StatusTag, ANOMALY_TYPE_ICONS } from './AnomalyTags';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const TYPE_ORDER: AnomalyType[] = ['unit_missing', 'unit_invalid', 'boundary_sample', 'bad_data', 'calculation_error'];

export default function AnomalyList() {
  const currentRun = useAppStore(s => s.currentRun);
  const filter = useAppStore(s => s.filter);
  const selectAnomaly = useAppStore(s => s.selectAnomaly);
  const selectedAnomalyId = useAppStore(s => s.selectedAnomalyId);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  if (!currentRun) {
    return (
      <div className="card p-12 text-center">
        <p className="text-ink-400 text-sm">暂无异常数据</p>
      </div>
    );
  }

  const filtered = filterAnomalies(currentRun.anomalies, filter);

  if (filtered.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckIcon />
        </div>
        <p className="text-ink-600 text-sm font-medium">没有匹配的异常记录</p>
        <p className="text-ink-400 text-xs mt-1">当前筛选条件下，异常队列为空</p>
      </div>
    );
  }

  const groups = groupAnomaliesByType(filtered);

  const toggleGroup = (type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {TYPE_ORDER.map(type => {
        const group = groups[type];
        if (!group || group.length === 0) return null;

        const isCollapsed = collapsedGroups.has(type);
        const Icon = ANOMALY_TYPE_ICONS[type];

        return (
          <div key={type} className="card overflow-hidden">
            <button
              onClick={() => toggleGroup(type)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink-50 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-ink-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-ink-400" />
              )}
              <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', typeBgClass(type))}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-ink-800">{ANOMALY_TYPE_LABELS[type]}</span>
              <span className="text-xs text-ink-400">·</span>
              <span className="text-xs font-medium text-ink-500">{group.length} 条</span>
              <div className="flex-1" />
              <span className="text-[11px] text-ink-400">{typeHint(type)}</span>
            </button>

            {!isCollapsed && (
              <div className="border-t border-ink-100 divide-y divide-ink-100 animate-fade-in">
                {group.map(anomaly => (
                  <AnomalyListItem
                    key={anomaly.id}
                    anomaly={anomaly}
                    isSelected={anomaly.id === selectedAnomalyId}
                    onClick={() => selectAnomaly(anomaly.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnomalyListItem({
  anomaly,
  isSelected,
  onClick,
}: {
  anomaly: AnomalyRecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  const rawKeys = Object.keys(anomaly.rawSnapshot);
  const title = anomaly.rawSnapshot[rawKeys[1]]?.toString() || anomaly.rawSnapshot[rawKeys[0]]?.toString() || '未命名记录';
  const id = anomaly.rawSnapshot[rawKeys[0]]?.toString() || anomaly.answerId;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group',
        isSelected ? 'bg-amber-50' : 'hover:bg-ink-50'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-ink-800 truncate">{title}</span>
          <span className="text-[11px] text-ink-400 font-mono flex-shrink-0">#{id}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AnomalyTypeTag type={anomaly.type} />
          <StatusTag status={anomaly.status} />
          <span className="text-[11px] text-ink-400">
            {anomaly.sourceInfo.source} · 行{anomaly.sourceInfo.originalRowIndex + 1}
          </span>
          {anomaly.calculation.value !== null && (
            <span className="text-[11px] text-ink-500 font-mono">
              计算: {anomaly.calculation.value.toFixed(4)}
              {anomaly.calculation.unit && ` ${anomaly.calculation.unit}`}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
    </div>
  );
}

function typeBgClass(type: AnomalyType): string {
  return {
    unit_missing: 'bg-red-50 text-anomaly-unit',
    unit_invalid: 'bg-red-50 text-red-700',
    boundary_sample: 'bg-purple-50 text-anomaly-boundary',
    bad_data: 'bg-gray-100 text-anomaly-bad',
    calculation_error: 'bg-amber-50 text-anomaly-calc',
  }[type];
}

function typeHint(type: AnomalyType): string {
  return {
    unit_missing: '需补充单位',
    unit_invalid: '需修正单位',
    boundary_sample: '需确认样本',
    bad_data: '需核对原始记录',
    calculation_error: '需检查公式',
  }[type];
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6 text-anomaly-normal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
