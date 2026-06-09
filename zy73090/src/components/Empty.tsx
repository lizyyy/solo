import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyProps {
  title?: string;
  description?: string;
  className?: string;
}

export default function Empty({
  title = '暂无数据',
  description = '当前条件下没有匹配的内容',
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-bg-elevated p-5">
        <Inbox className="h-10 w-10 text-slate-500" />
      </div>
      <p className="font-display text-lg font-semibold text-slate-300">{title}</p>
      <p className="max-w-xs text-sm text-slate-500">{description}</p>
    </div>
  );
}
