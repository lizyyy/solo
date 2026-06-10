import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyProps {
  title?: string;
  description?: string;
  className?: string;
}

export default function Empty({
  title = '暂无数据',
  description = '当前筛选条件下没有匹配的内容',
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[160px] flex-col items-center justify-center text-center',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox size={22} />
      </div>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {description && (
        <div className="mt-1 max-w-xs text-xs text-slate-400">{description}</div>
      )}
    </div>
  );
}
