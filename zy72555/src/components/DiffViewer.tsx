import type { ChangeHistory } from '@/types';
import { Clock, User, ArrowRight, RotateCcw } from 'lucide-react';

interface DiffViewerProps {
  history: ChangeHistory;
  onRollback?: (historyId: string) => void;
  showRollback?: boolean;
}

const fieldLabels: Record<string, string> = {
  status: '状态',
  remark: '备注',
  minorityMetric: '少数类指标',
  overallMetric: '总指标',
  isBoundaryCase: '是否边界案例',
  boundaryReason: '边界原因',
  content: '笔记内容',
  isLateArrival: '是否晚到',
  trainingLogIds: '关联日志',
};

const statusLabels: Record<string, string> = {
  pending: '未处理',
  reviewing: '待复核',
  confirmed: '已确认',
  rejected: '已驳回',
};

function formatValue(key: string, value: any): string {
  if (value === undefined || value === null || value === '') return '-';
  if (key === 'status') return statusLabels[value] || value;
  if (key === 'isBoundaryCase' || key === 'isLateArrival') return value ? '是' : '否';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function DiffViewer({ history, onRollback, showRollback = false }: DiffViewerProps) {
  const hasChangedFields = history.changedFields && history.changedFields.length > 0;
  const fieldsToShow = hasChangedFields ? history.changedFields : Object.keys(history.afterSnapshot || {});

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Clock size={14} />
            {new Date(history.operatedAt).toLocaleString('zh-CN')}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <User size={14} />
            {history.operator}
          </div>
          <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
            {history.operationType === 'create'
              ? '创建'
              : history.operationType === 'update'
              ? '更新'
              : history.operationType === 'import'
              ? '导入'
              : '回滚'}
          </span>
        </div>
        {showRollback && history.operationType !== 'rollback' && onRollback && (
          <button
            onClick={() => onRollback(history.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
          >
            <RotateCcw size={12} />
            回滚此操作
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {fieldsToShow.map((field) => {
          const beforeVal = formatValue(field, history.beforeSnapshot?.[field]);
          const afterVal = formatValue(field, history.afterSnapshot?.[field]);
          const hasChange = beforeVal !== afterVal;

          return (
            <div key={field} className="grid grid-cols-[120px_1fr_24px_1fr] gap-3 items-start">
              <div className="text-sm text-slate-400 pt-1">{fieldLabels[field] || field}</div>
              <div
                className={`text-sm p-2 rounded font-mono ${
                  hasChange ? 'bg-red-900/30 text-red-300 line-through' : 'bg-slate-700/50 text-slate-300'
                }`}
              >
                {beforeVal}
              </div>
              <div className="flex items-center justify-center pt-1">
                <ArrowRight size={16} className="text-slate-500" />
              </div>
              <div
                className={`text-sm p-2 rounded font-mono ${
                  hasChange ? 'bg-emerald-900/30 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                }`}
              >
                {afterVal}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
