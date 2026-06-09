import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDisclosureStore } from '@/store/disclosureStore';
import type { DisclosureItem, ItemStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Home,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  ListTodo,
  MapPin,
  User,
  Gauge,
  ChevronRight,
  Phone,
  Briefcase,
  PhoneCall,
  Filter,
  CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOffset } from '@/lib/coordinate';

type ColumnKey = 'confirmed' | 'awaiting_patch' | 'reverted';

const COLUMNS: { key: ColumnKey; label: string; icon: typeof FileCheck2; accent: string; header: string; card: string }[] = [
  {
    key: 'confirmed',
    label: '已确认',
    icon: FileCheck2,
    accent: 'text-emerald-700 bg-emerald-100',
    header: 'from-emerald-50 via-emerald-50/50 to-white border-emerald-200',
    card: 'hover:border-emerald-300 hover:shadow-emerald-100',
  },
  {
    key: 'awaiting_patch',
    label: '待补件',
    icon: AlertTriangle,
    accent: 'text-orange-700 bg-orange-100',
    header: 'from-orange-50 via-orange-50/50 to-white border-orange-200',
    card: 'hover:border-orange-300 hover:shadow-orange-100',
  },
  {
    key: 'reverted',
    label: '退回记录',
    icon: RotateCcw,
    accent: 'text-rose-700 bg-rose-100',
    header: 'from-rose-50 via-rose-50/50 to-white border-rose-200',
    card: 'hover:border-rose-300 hover:shadow-rose-100',
  },
];

function KanbanCard({
  item,
  accent,
}: {
  item: DisclosureItem;
  accent: string;
}) {
  const navigate = useNavigate();
  return (
    <article
      onClick={() => navigate(`/item/${item.id}`)}
      className={cn(
        'group cursor-pointer space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        accent
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-orange-700">
          {item.title}
        </h4>
        <ChevronRight className="mt-0.5 h-4 w-4 flex-none text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500" strokeWidth={2.2} />
      </div>

      <div className="space-y-1.5 text-[11.5px] text-slate-600">
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="h-3 w-3 flex-none text-slate-400" strokeWidth={2} />
          <span className="truncate">{item.fireZone}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <User className="h-3 w-3 flex-none text-slate-400" strokeWidth={2} />
          <span className="truncate">{item.responsiblePerson}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Gauge className="h-3 w-3 flex-none text-slate-400" strokeWidth={2} />
          <span className="truncate font-mono text-[11px]">
            偏移 {formatOffset(item.coordinateOffset)}
          </span>
        </div>
      </div>

      {item.status === 'awaiting_patch' && item.nextContact && (
        <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-800 truncate">
                <Briefcase className="h-2.5 w-2.5 flex-none" strokeWidth={2.5} />
                {item.nextContactRole}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-orange-700 truncate">
                <span className="truncate">{item.nextContact}</span>
                <Phone className="h-2.5 w-2.5" strokeWidth={2.5} />
                <span className="font-mono">{item.nextContactPhone}</span>
              </div>
            </div>
            <a
              onClick={(e) => e.stopPropagation()}
              href={`tel:${item.nextContactPhone?.replace(/-/g, '')}`}
              className="inline-flex h-7 items-center gap-0.5 rounded-md bg-orange-600 px-2 text-[10.5px] font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              <PhoneCall className="h-3 w-3" strokeWidth={2.5} />
              拨号
            </a>
          </div>
        </div>
      )}

      {(item.status === 'reverted' && item.revertReason) && (
        <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-2.5">
          <div className="line-clamp-2 text-[11px] leading-relaxed text-rose-800">
            <span className="font-semibold">撤回原因：</span>
            {item.revertReason}
          </div>
        </div>
      )}

      {(item.status === 'confirmed' && item.confirmRemark) && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
          <div className="line-clamp-2 text-[11px] leading-relaxed text-emerald-800">
            <span className="font-semibold">备注：</span>
            {item.confirmRemark}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <StatusBadge status={item.status} size="sm" />
        <span className="text-[10.5px] text-slate-400">
          查看详情 →
        </span>
      </div>
    </article>
  );
}

export default function MonthlyReviewPage() {
  const items = useDisclosureStore((s) => s.items);
  const getFilteredItems = useDisclosureStore((s) => s.getFilteredItems);

  const [zoneFilter, setZoneFilter] = React.useState<string>('all');

  const summary = React.useMemo(() => {
    const s = { total: items.length, pending: 0, confirmed: 0, awaitingPatch: 0, reverted: 0 };
    for (const it of items) {
      if (it.status === 'confirmed') s.confirmed++;
      else if (it.status === 'awaiting_patch') s.awaitingPatch++;
      else if (it.status === 'reverted') s.reverted++;
      else s.pending++;
    }
    return s;
  }, [items]);

  const allZones = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.fireZone));
    return Array.from(set);
  }, [items]);

  const filterByZone = (list: DisclosureItem[]) => {
    if (zoneFilter === 'all') return list;
    return list.filter((i) => i.fireZone === zoneFilter);
  };

  const confirmedList = React.useMemo(
    () => filterByZone(getFilteredItems('confirmed')),
    [zoneFilter, getFilteredItems, items]
  );
  const awaitingList = React.useMemo(
    () => filterByZone(getFilteredItems('awaiting_patch')),
    [zoneFilter, getFilteredItems, items]
  );
  const revertedList = React.useMemo(
    () => filterByZone(getFilteredItems('reverted')),
    [zoneFilter, getFilteredItems, items]
  );

  const dataMap: Record<ColumnKey, DisclosureItem[]> = {
    confirmed: confirmedList,
    awaiting_patch: awaitingList,
    reverted: revertedList,
  };

  const totalCount = confirmedList.length + awaitingList.length + revertedList.length;

  const monthLabel = '2026年6月';

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <CalendarRange className="h-4.5 w-4.5 text-orange-600" strokeWidth={2.2} />
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-orange-700">
              {monthLabel}月底复核
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">月底复核三栏视图</h1>
          <p className="mt-1 text-sm text-slate-500">
            施工经理阿乔需要把已确认、待补件和退回记录分清楚，所有数据来自同一份本地源
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="all">全部分区</option>
              {allZones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Home className="h-3.5 w-3.5" strokeWidth={2} />
            返回清单
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          const count = dataMap[col.key].length;
          const pct = totalCount === 0 ? 0 : Math.round((count / totalCount) * 100);
          return (
            <div
              key={col.key}
              className={cn(
                'rounded-xl border bg-gradient-to-b p-4 shadow-sm',
                col.header
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('rounded-lg p-1.5', col.accent)}>
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <span className="text-sm font-bold text-slate-900">{col.label}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold tabular-nums text-slate-900">{count}</div>
                  <div className="text-[10.5px] font-medium text-slate-500">
                    {totalCount > 0 ? `${pct}%` : '—'}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    col.key === 'confirmed' && 'bg-emerald-500',
                    col.key === 'awaiting_patch' && 'bg-orange-500',
                    col.key === 'reverted' && 'bg-rose-500'
                  )}
                  style={{ width: `${totalCount > 0 ? pct : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20">
          <ListTodo className="h-12 w-12 text-slate-300" strokeWidth={1.8} />
          <div className="mt-3 text-sm font-medium text-slate-600">本月还没有复核数据</div>
          <div className="mt-1 text-xs text-slate-400">先载入小包材料或导入文件，再进行月底复核</div>
          <Link
            to="/import"
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-xs font-semibold text-white shadow-sm shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
          >
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" strokeWidth={2.2} />
            去导入材料
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className="rounded-2xl border border-slate-200 bg-slate-50/30 shadow-sm"
            >
              <div
                className={cn(
                  'flex items-center justify-between rounded-t-2xl border-b px-5 py-3.5 bg-gradient-to-r',
                  col.header
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('rounded-lg p-1.5', col.accent)}>
                    <col.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </div>
                  <span className="text-sm font-bold text-slate-900">{col.label}</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-500">
                  {dataMap[col.key].length} 条
                </span>
              </div>
              <div className="space-y-3 p-4 max-h-[65vh] overflow-y-auto">
                {dataMap[col.key].length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-200 shadow-sm ring-1 ring-slate-100">
                      <col.icon className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    <div className="mt-3 text-[12px] font-medium text-slate-500">
                      暂无{col.label}记录
                    </div>
                  </div>
                ) : (
                  dataMap[col.key].map((item, idx) => (
                    <div
                      key={item.id}
                      className="animate-[fadeInUp_0.3s_ease-out]"
                      style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}
                    >
                      <KanbanCard item={item} accent={col.card} />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          月底复核汇总
        </h3>
        <div className="grid grid-cols-2 gap-4 text-[13px] leading-relaxed text-slate-700 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50/60 p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">复核月份</div>
            <div className="mt-1 font-bold text-slate-900">{monthLabel}</div>
          </div>
          <div className="rounded-xl bg-emerald-50/60 p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-emerald-600">已确认</div>
            <div className="mt-1 font-bold text-emerald-800">{confirmedList.length} 条</div>
          </div>
          <div className="rounded-xl bg-orange-50/60 p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-orange-600">待补件跟进</div>
            <div className="mt-1 font-bold text-orange-800">{awaitingList.length} 条需跟进</div>
          </div>
          <div className="rounded-xl bg-rose-50/60 p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-rose-600">退回需重审</div>
            <div className="mt-1 font-bold text-rose-800">{revertedList.length} 条待修改</div>
          </div>
        </div>
      </div>
    </div>
  );
}
