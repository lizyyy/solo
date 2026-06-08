import { useState } from 'react';
import { History, Clock, User, ArrowRight, FileText, ClipboardList, Filter, AlertTriangle, Shield, Upload } from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

type EntityType = 'all' | 'obstacle_note' | 'safety_report' | 'alarm_review' | 'rangefinder_record';

const entityLabels: Record<EntityType, string> = {
  all: '全部',
  obstacle_note: '障碍物备注',
  safety_report: '安全报告',
  alarm_review: '告警复核',
  rangefinder_record: '测距记录',
};

const entityIcons: Record<string, typeof FileText> = {
  obstacle_note: FileText,
  safety_report: ClipboardList,
  alarm_review: AlertTriangle,
  rangefinder_record: Upload,
};

const statusLabels: Record<string, string> = {
  pending: '待复核',
  normal: '正常',
  abnormal: '异常',
  onsite: '需现场',
  completed: '已完成',
  verify: '需核实',
  draft: '草稿',
  confirmed: '已确认',
  exported: '已导出',
};

export default function HistoryPage() {
  const { changeHistories } = useAppStore();
  const [filter, setFilter] = useState<EntityType>('all');

  const filteredHistories = changeHistories
    .filter((h) => filter === 'all' || h.entityType === filter)
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getEntityLabel = (entityType: string) => {
    return entityLabels[entityType as EntityType] || entityType;
  };

  const formatValue = (value: string) => {
    if (statusLabels[value]) return statusLabels[value];
    return value || '(空)';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900 mb-1">变更历史</h1>
          <p className="text-gray-500 text-sm">所有操作留痕，改前改后可追溯</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          {Object.entries(entityLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key as EntityType)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                filter === key
                  ? 'bg-industrial-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredHistories.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">暂无变更历史记录</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-6">
            {filteredHistories.map((history) => {
              const EntityIcon = entityIcons[history.entityType] || FileText;
              const isStatusField = history.fieldName === 'status' || history.fieldName === 'reviewStatus';

              return (
                <div key={history.id} className="relative pl-16">
                  <div className="absolute left-4 top-2 w-5 h-5 rounded-full bg-industrial-100 border-2 border-industrial-400 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-industrial-500" />
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <EntityIcon className="w-4 h-4 text-industrial-500" />
                        <span className="text-sm font-medium text-industrial-700">
                          {getEntityLabel(history.entityType)}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{history.fieldName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {history.operator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(history.operatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                          <p className="text-xs font-medium text-red-600 mb-2">改前</p>
                          <p className="text-sm text-red-800 whitespace-pre-wrap">
                            {isStatusField ? formatValue(history.oldValue) : (history.oldValue || '(空)')}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                          <p className="text-xs font-medium text-green-600 mb-2">改后</p>
                          <p className="text-sm text-green-800 whitespace-pre-wrap">
                            {isStatusField ? formatValue(history.newValue) : (history.newValue || '(空)')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center my-2">
                        <ArrowRight className="w-5 h-5 text-gray-300" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
