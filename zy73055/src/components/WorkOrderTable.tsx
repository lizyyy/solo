import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Eye, AlertTriangle, Clock, FileWarning } from 'lucide-react';
import { useWorkOrderStore, useFilteredWorkOrders, useStatistics } from '../store/workOrderStore';
import { LateBadge } from './LateBadge';
import {
  STATUS_LABELS, JUDGMENT_LABELS, PRIORITY_LABELS, SHIFT_LABELS,
} from '../types';
import type { WorkOrder } from '../types';

type SortKey = 'reportTime' | 'priority' | 'orderNo' | 'deviceNo';
type SortDir = 'asc' | 'desc';

const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const JUDGMENT_CLASS: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  abnormal: 'bg-red-100 text-red-800 border-red-300',
  pending_review: 'bg-amber-100 text-amber-800 border-amber-200',
};
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
  abnormal: 'bg-red-100 text-red-800 border-red-200',
};
const PRIORITY_CLASS: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  critical: 'text-red-600 font-bold',
};

export function WorkOrderTable() {
  const filteredWorkOrders = useFilteredWorkOrders();
  const statistics = useStatistics();
  const { selectOrder, selectedOrderId } = useWorkOrderStore();
  const [sortKey, setSortKey] = useState<SortKey>('reportTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOrderId) {
      setHighlightId(selectedOrderId);
      const t = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [selectedOrderId]);

  const sorted = useMemo(() => {
    const arr = [...filteredWorkOrders];
    arr.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case 'reportTime': r = new Date(a.reportTime).getTime() - new Date(b.reportTime).getTime(); break;
        case 'priority': r = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]; break;
        case 'orderNo': r = a.orderNo.localeCompare(b.orderNo); break;
        case 'deviceNo': r = a.deviceNo.localeCompare(b.deviceNo); break;
      }
      return sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filteredWorkOrders, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-100 transition-colors whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
      </span>
    </th>
  );

  const hasLate = (o: WorkOrder) => o.photos.some(p => p.isLateArrival) || o.attachments.some(a => a.isLateArrival);
  const hasOld = (o: WorkOrder) => o.photos.some(p => p.hitsOldTerminology);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="text-sm font-semibold text-slate-800">
          工单明细表 <span className="text-xs text-slate-500 font-normal ml-1">（共 {filteredWorkOrders.length} 条 · 同源数据源）</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" />含晚到附件/旧说法</span>
          <span className="inline-flex items-center gap-1"><FileWarning className="w-3 h-3 text-blue-500" />设备编号重复</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto max-h-[540px]">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <SortHeader k="orderNo" label="工单编号" />
              <SortHeader k="deviceNo" label="设备编号" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700">设备名称 / 故障</th>
              <SortHeader k="reportTime" label="上报时间" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700">上报人/班次</th>
              <SortHeader k="priority" label="优先级" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700">工单状态</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700">审核判断</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700">标记</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-slate-400 text-sm">
                  <div className="text-4xl mb-2">🔍</div>
                  <div>当前筛选条件下无工单</div>
                  <div className="text-xs mt-1">提示：此结果与上方统计卡片、右侧异常队列完全同源</div>
                </td>
              </tr>
            )}
            {sorted.map((o, idx) => {
              const isAbnormalLine = o.judgment === 'abnormal' || o.judgment === 'pending_review';
              const isHighlighted = highlightId === o.id;
              return (
                <tr
                  key={o.id}
                  onClick={() => selectOrder(o.id)}
                  className={`
                    ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
                    ${isAbnormalLine ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent'}
                    ${isHighlighted ? 'bg-yellow-100/60 ring-2 ring-yellow-400' : ''}
                    hover:bg-slate-100/60 transition-colors cursor-pointer group
                  `}
                >
                  <td className="px-3 py-2.5 font-mono text-slate-800 font-medium">{o.orderNo}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-slate-700">{o.deviceNo}</span>
                    {o.isDuplicateWarning && (
                      <FileWarning className="w-3 h-3 text-blue-600 inline ml-1 align-middle" aria-label="设备编号重复，非报错" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-800 font-medium truncate max-w-[200px]" title={o.deviceName}>{o.deviceName}</div>
                    <div className="text-slate-500 text-[11px] truncate max-w-[200px]" title={o.faultDescription}>
                      <span className="text-red-500">●</span> {o.faultType} — {o.faultDescription}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{o.reportTime.slice(5, 16)}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-700">{o.reporter}</div>
                    <div className="text-[11px] text-slate-500">{SHIFT_LABELS[o.shift]}</div>
                  </td>
                  <td className={`px-3 py-2.5 font-semibold ${PRIORITY_CLASS[o.priority]}`}>
                    {PRIORITY_LABELS[o.priority]}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[11px] ${STATUS_CLASS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${JUDGMENT_CLASS[o.judgment]}`}>
                      {JUDGMENT_LABELS[o.judgment]}
                    </span>
                    {o.judgmentHistory.length >= 2 && (
                      <span className="ml-1 inline-block text-[10px] text-indigo-600 bg-indigo-50 rounded px-1 border border-indigo-200">
                        修改{o.judgmentHistory.length}次
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                      {hasLate(o) && <LateBadge compact />}
                      {hasOld(o) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-medium" title="命中旧说法">
                          旧说法
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-white text-[11px] hover:bg-slate-800 transition-colors opacity-80 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); selectOrder(o.id); }}
                    >
                      <Eye className="w-3 h-3" />查看
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
        <span>显示 {sorted.length} / 全量 {statistics.total} 条</span>
        <span className="font-medium">※ 统计、明细、异常队列三者数据源完全一致</span>
      </div>
    </div>
  );
}
