import React from 'react';
import { Clock } from 'lucide-react';
import { formatTime } from '@/utils/storage';
import type { Record } from '@/types';

interface TimelineProps {
  records: Record[];
  onRecordClick?: (record: Record) => void;
  activeRecordId?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ records, onRecordClick, activeRecordId }) => {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-lab-text-muted">
        <Clock size={48} className="mb-4 opacity-50" />
        <p>暂无记录</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-lab-border" />

      <div className="space-y-4">
        {records.map((record) => (
          <div
            key={record.id}
            className={`relative pl-12 cursor-pointer transition-all duration-200 ${
              activeRecordId === record.id ? 'animate-slide-in' : ''
            }`}
            onClick={() => onRecordClick?.(record)}
          >
            <div
              className={`absolute left-2 top-2 w-5 h-5 rounded-full border-2 ${
                getMaterialColor(record.materialType)
              } ${activeRecordId === record.id ? 'animate-pulse-border scale-125' : ''}`}
            />

            <div
              className={`p-4 border-2 bg-lab-card transition-all duration-200 hover:border-lab-accent ${
                activeRecordId === record.id ? 'border-lab-accent' : 'border-lab-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-lab-text-muted font-mono">
                  {formatTime(record.timestamp)}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-mono ${
                    record.materialType === 'supplement'
                      ? 'bg-lab-supplement/20 text-lab-supplement'
                      : 'bg-lab-conclusion/20 text-lab-conclusion'
                  }`}
                >
                  {record.materialType === 'supplement' ? '补材料' : '改结论'}
                </span>
              </div>

              <p className="text-sm text-lab-text mb-2 line-clamp-2">{record.content}</p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-lab-text-muted">{record.operator}</span>
                {record.annotation && (
                  <span
                    className={`px-2 py-0.5 text-xs font-mono ${
                      record.annotation.anomalyType === 'normal'
                        ? 'bg-lab-accent/20 text-lab-accent'
                        : 'bg-lab-anomaly/20 text-lab-anomaly'
                    }`}
                  >
                    {getAnomalyLabel(record.annotation.anomalyType)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const getMaterialColor = (type: string): string => {
  switch (type) {
    case 'supplement':
      return 'border-lab-supplement bg-lab-bg';
    case 'conclusion_change':
      return 'border-lab-conclusion bg-lab-bg';
    default:
      return 'border-lab-border bg-lab-bg';
  }
};

const getAnomalyLabel = (type: string): string => {
  const labels: Record<string, string> = {
    normal: '正常',
    view_reset: '视角重置',
    misoperation: '误操作',
    other: '其他',
  };
  return labels[type] || type;
};
