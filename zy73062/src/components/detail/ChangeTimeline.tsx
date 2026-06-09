import {
  Plus, Edit3, XCircle, CheckCircle2, X, RotateCcw, ArrowLeftRight, FileWarning, Quote,
  ArrowRight, User, Calendar
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChangeHistoryItem, ChangeType } from '@/types/schedule';
import { cn } from '@/lib/utils';

interface ChangeTimelineProps {
  items: ChangeHistoryItem[];
}

const changeConfig: Record<ChangeType, {
  icon: LucideIcon;
  dot: string;
  label: string;
  labelBg: string;
  labelText: string;
}> = {
  create: {
    icon: Plus, dot: 'bg-blue-500', label: '创建',
    labelBg: 'bg-blue-50', labelText: 'text-blue-700',
  },
  update: {
    icon: Edit3, dot: 'bg-violet-500', label: '更新',
    labelBg: 'bg-violet-50', labelText: 'text-violet-700',
  },
  withdraw: {
    icon: XCircle, dot: 'bg-gray-400', label: '撤回',
    labelBg: 'bg-gray-100', labelText: 'text-gray-600',
  },
  confirm: {
    icon: CheckCircle2, dot: 'bg-success', label: '确认',
    labelBg: 'bg-green-50', labelText: 'text-green-700',
  },
  reject: {
    icon: X, dot: 'bg-danger', label: '驳回',
    labelBg: 'bg-red-50', labelText: 'text-red-700',
  },
  resubmit: {
    icon: RotateCcw, dot: 'bg-indigo-500', label: '重复提交',
    labelBg: 'bg-indigo-50', labelText: 'text-indigo-700',
  },
  model_replace: {
    icon: ArrowLeftRight, dot: 'bg-warning', label: '型号替换',
    labelBg: 'bg-orange-50', labelText: 'text-orange-700',
  },
};

export default function ChangeTimeline({ items }: ChangeTimelineProps) {
  const sorted = [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (sorted.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">
        <FileWarning size={32} className="mx-auto mb-2 opacity-60" />
        暂无变更历史
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary-600 rounded" />
        变更历史时间线
        <span className="ml-2 text-xs text-slate-400 font-normal">共 {sorted.length} 条记录</span>
      </h3>

      <div className="relative pl-8">
        <div className="absolute left-3 top-1 bottom-1 w-0.5 bg-gradient-to-b from-primary-200 via-slate-200 to-slate-100 rounded" />

        <div className="space-y-5">
          {sorted.map((item, idx) => {
            const cfg = changeConfig[item.changeType] || changeConfig.update;
            const Icon = cfg.icon;
            const isLatest = idx === 0;

            return (
              <div key={item.id} className="relative animate-expand" style={{ animationDelay: `${idx * 40}ms` }}>
                <div
                  className={cn(
                    'absolute -left-5 top-1.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm',
                    cfg.dot
                  )}
                >
                  <Icon size={12} className="text-white" strokeWidth={2.5} />
                </div>

                <div
                  className={cn(
                    'rounded-lg border p-4 transition-all duration-200 hover:shadow-md',
                    isLatest
                      ? 'bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm'
                      : 'bg-white border-slate-100'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                        cfg.labelBg, cfg.labelText
                      )}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <User size={12} />
                      {item.operator}
                    </span>
                    <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                      <Calendar size={12} />
                      {item.timestamp}
                    </span>
                  </div>

                  {(item.oldMaterial || item.newMaterial) && (
                    <div className="mb-2 text-sm">
                      <span className="text-xs text-slate-500 mr-2">备件材料：</span>
                      {item.oldMaterial && (
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-500 line-through text-xs mr-1">
                          {item.oldMaterial}
                        </span>
                      )}
                      {item.oldMaterial && item.newMaterial && (
                        <ArrowRight size={12} className="inline text-slate-400 mx-1" />
                      )}
                      {item.newMaterial && (
                        <span className="inline-block px-2 py-0.5 rounded bg-primary-50 text-primary-700 font-medium text-xs border border-primary-100">
                          {item.newMaterial}
                        </span>
                      )}
                    </div>
                  )}

                  {(item.oldRemark || item.newRemark) && (
                    <div className="mb-2 text-sm">
                      <span className="text-xs text-slate-500 mr-2">备注内容：</span>
                      {item.oldRemark && (
                        <span className="inline-block text-gray-400 italic line-through text-xs mr-2 max-w-md truncate align-middle">
                          「{item.oldRemark}」
                        </span>
                      )}
                      {item.newRemark && (
                        <span className="inline-block text-slate-800 text-xs max-w-md truncate align-middle">
                          「{item.newRemark}」
                        </span>
                      )}
                    </div>
                  )}

                  {item.reason && (
                    <div className="mt-3 flex gap-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                      <Quote size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
