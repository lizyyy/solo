import { Timeline, Tag } from 'antd';
import { Clock, User, FileEdit, Plus, Edit3, AlertCircle } from 'lucide-react';
import type { ChangeLog, ChangeType } from '@/types';
import { formatDateTime } from '@/utils/storage';

const changeTypeConfig: Record<ChangeType, { label: string; color: string; icon: typeof FileEdit }> = {
  create: { label: '创建', color: 'green', icon: Plus },
  update: { label: '更新', color: 'blue', icon: Edit3 },
  batch_add: { label: '批次补录', color: 'purple', icon: Plus },
  judgment_change: { label: '结论改判', color: 'orange', icon: AlertCircle },
};

interface ChangeTimelineProps {
  logs: ChangeLog[];
}

export default function ChangeTimeline({ logs }: ChangeTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <FileEdit className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>暂无变更记录</p>
      </div>
    );
  }

  return (
    <Timeline
      mode="left"
      items={logs.map((log) => {
        const config = changeTypeConfig[log.changeType];
        const Icon = config.icon;
        return {
          color: config.color as 'green' | 'blue' | 'orange' | 'purple',
          dot: <Icon className="w-4 h-4" />,
          label: (
            <div className="text-xs text-slate-500 whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(log.changedAt)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <User className="w-3 h-3" />
                {log.operator}
              </div>
            </div>
          ),
          children: (
            <div className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Tag color={config.color}>{config.label}</Tag>
                <span className="font-medium text-slate-700">{log.fieldName}</span>
              </div>

              {log.oldValue && (
                <div className="text-sm mb-1">
                  <span className="text-slate-500">旧值：</span>
                  <span className="line-through text-slate-400">{log.oldValue}</span>
                </div>
              )}

              {log.newValue && (
                <div className="text-sm mb-2">
                  <span className="text-slate-500">新值：</span>
                  <span className="text-slate-700 font-medium">{log.newValue}</span>
                </div>
              )}

              {log.reason && (
                <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mb-1">
                  <span className="font-medium">改判原因：</span>
                  {log.reason}
                </div>
              )}

              {log.remark && (
                <div className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                  <span className="font-medium">备注：</span>
                  {log.remark}
                </div>
              )}
            </div>
          ),
        };
      })}
    />
  );
}
