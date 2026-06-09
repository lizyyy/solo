import { Link } from 'react-router-dom';
import type { DisclosureItem } from '@/types';
import { StatusBadge } from './StatusBadge';
import { cn, formatDate } from '@/lib/utils';
import {
  ChevronRight,
  MapPin,
  User,
  Phone,
  Gauge,
  AlertOctagon,
  FileEdit,
} from 'lucide-react';
import { formatOffset } from '@/lib/coordinate';

export function ItemCard({ item }: { item: DisclosureItem }) {
  const hasOffsetRisk = item.offsetRiskLevel !== 'none';
  const hasManualChange = !!item.manualChangeContent;
  const hasSupplement = !!item.supplementContent;

  return (
    <Link
      to={`/item/${item.id}`}
      className={cn(
        'group block overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl',
        item.status === 'confirmed' && 'hover:border-emerald-300',
        item.status === 'awaiting_patch' && 'hover:border-orange-400',
        item.status === 'reverted' && 'hover:border-rose-300',
        item.status === 'pending' && 'hover:border-amber-300'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={item.status} size="sm" />
            {hasManualChange && (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10.5px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                <FileEdit className="h-3 w-3" strokeWidth={2.5} />
                人工改判
              </span>
            )}
            {hasSupplement && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
                补充说明
              </span>
            )}
          </div>
          <h3 className="mt-2.5 line-clamp-1 text-base font-semibold text-slate-900 transition-colors group-hover:text-orange-700">
            {item.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
            {item.content}
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 flex-none text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-orange-500" strokeWidth={2.2} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3.5 text-[12px]">
        <div className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
          <span className="truncate">{item.fireZone}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <User className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
          <span className="truncate">{item.responsiblePerson}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Phone className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
          <span className="truncate font-mono text-[11.5px]">{item.contactPhone}</span>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5',
            item.coordinateOffset === 0 ? 'text-slate-600' : 'text-orange-700'
          )}
        >
          {hasOffsetRisk ? (
            <AlertOctagon className="h-3.5 w-3.5 flex-none text-orange-500" strokeWidth={2.2} />
          ) : (
            <Gauge className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
          )}
          <span className="truncate font-mono text-[11.5px]">
            偏移 {formatOffset(item.coordinateOffset)}
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
        <span>最后更新 {formatDate(item.updatedAt)}</span>
        <span className="truncate max-w-[50%]">#{item.createdFrom === 'quickstart' ? '小包试手' : '文件导入'}</span>
      </div>
    </Link>
  );
}
