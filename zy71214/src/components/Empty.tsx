import { cn } from '@/lib/utils';
import { Inbox, ArrowLeft } from 'lucide-react';

interface EmptyProps {
  message?: string;
  onBack?: () => void;
}

export default function Empty({ message = '暂无数据', onBack }: EmptyProps) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-4 p-8')}>
      <Inbox size={48} className="text-slate-300" />
      <p className="text-slate-500">{message}</p>
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>
      )}
    </div>
  );
}
