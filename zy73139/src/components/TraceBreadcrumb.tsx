import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isLast?: boolean;
}

interface TraceBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function TraceBreadcrumb({ items }: TraceBreadcrumbProps) {
  return (
    <nav className="flex items-center text-sm text-slate-500">
      <button
        className="flex items-center gap-1 hover:text-sky-600 transition-colors"
        onClick={items[0]?.onClick}
      >
        <Home className="w-4 h-4" />
        <span>首页</span>
      </button>

      {items.slice(1).map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
          <span
            className={cn(
              'max-w-[200px] truncate',
              item.isLast
                ? 'text-slate-800 font-medium'
                : 'hover:text-sky-600 cursor-pointer transition-colors'
            )}
            onClick={item.onClick}
          >
            {item.label}
          </span>
        </div>
      ))}
    </nav>
  );
}
