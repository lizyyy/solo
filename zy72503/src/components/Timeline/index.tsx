import type { RemarkHistory } from '@/types';
import { RoleBadge } from '@/components/StatusBadge';
import { Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineProps {
  items: RemarkHistory[];
}

export function Timeline({ items }: TimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">暂无历史记录</p>
      </div>
    );
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
      
      <div className="space-y-6">
        {items.map((item, index) => (
          <div key={item.id} className="relative pl-10 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-primary-500 shadow-sm z-10" />
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 hover:border-primary-200 transition-colors">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{item.operator}</span>
                </div>
                <RoleBadge role={item.operatorRole} />
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {formatTime(item.createdAt)}
                </div>
              </div>
              
              {item.oldRemark ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">修改前：</p>
                    <p className={cn(
                      'text-sm p-2 rounded-lg line-through',
                      'bg-rose-50 text-rose-600 border border-rose-100'
                    )}>
                      {item.oldRemark || '<空>'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">修改后：</p>
                    <p className={cn(
                      'text-sm p-2 rounded-lg',
                      'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    )}>
                      {item.newRemark}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-400 mb-1">新增备注：</p>
                  <p className="text-sm text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                    {item.newRemark}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
