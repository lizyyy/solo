import { useRecordStore } from '../../store/useRecordStore';
import { cn } from '../../utils/status';
import { Check } from 'lucide-react';

const checklistItems = [
  {
    key: 'weatherChecked' as const,
    label: '气象截图检查',
    description: '每架次均有对应气象截图，时间戳匹配，补录已标注原因',
  },
  {
    key: 'returnPointChecked' as const,
    label: '返航点状态检查',
    description: '所有"返航点丢失"记录已核查，异常架次已按处理口径标注',
  },
  {
    key: 'modificationChecked' as const,
    label: '改动记录确认',
    description: '所有"人工改过"记录已查看修改原因，修改人均已提交书面说明',
  },
  {
    key: 'classificationChecked' as const,
    label: '分类准确性确认',
    description: '"已确认/待补/人工改过"分类准确，处理口径已正确应用',
  },
];

export function ReviewChecklist() {
  const { reviewChecklist, toggleChecklistItem, isChecklistComplete } = useRecordStore();

  return (
    <div className="border border-mono-300 bg-mono-50 p-4">
      <h3 className="font-bold text-mono-800 mb-3">导出前复核清单</h3>
      <p className="text-xs text-mono-500 mb-4">
        必须全部勾选后方可启用导出按钮
      </p>
      <div className="space-y-3">
        {checklistItems.map((item) => {
          const checked = reviewChecklist[item.key];
          return (
            <label
              key={item.key}
              className={cn(
                'flex items-start gap-3 p-3 border cursor-pointer transition-colors',
                checked
                  ? 'border-farm-400 bg-farm-50'
                  : 'border-mono-200 bg-white hover:border-mono-300'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 border flex items-center justify-center flex-shrink-0 mt-0.5',
                  checked
                    ? 'bg-farm-500 border-farm-500 text-white'
                    : 'border-mono-300 bg-white'
                )}
                onClick={() => toggleChecklistItem(item.key)}
              >
                {checked && <Check size={14} strokeWidth={3} />}
              </div>
              <div>
                <p className={cn(
                  'text-sm font-medium',
                  checked ? 'text-farm-700' : 'text-mono-700'
                )}>
                  {item.label}
                </p>
                <p className="text-xs text-mono-500 mt-0.5">{item.description}</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-mono-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-mono-600">
            复核状态：
          </span>
          <span
            className={cn(
              'text-sm font-medium',
              isChecklistComplete() ? 'text-farm-600' : 'text-status-pending'
            )}
          >
            {isChecklistComplete() ? '✓ 已完成全部复核' : '未完成'}
          </span>
        </div>
      </div>
    </div>
  );
}
