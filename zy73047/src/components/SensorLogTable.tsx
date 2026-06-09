import { useEffect, useRef } from 'react';
import type { SensorLog, Material } from '@/types';
import { LogStatusBadge } from './Badges';
import { formatDateTime, cn } from '@/lib/utils';
import { Package, Link2 } from 'lucide-react';

interface Props {
  logs: SensorLog[];
  materials?: Material[];
  highlightLogId?: string;
  onHighlightCleared?: () => void;
}

export default function SensorLogTable({
  logs,
  materials = [],
  highlightLogId,
  onHighlightCleared,
}: Props) {
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (highlightLogId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => onHighlightCleared?.(), 2500);
      return () => clearTimeout(t);
    }
  }, [highlightLogId, onHighlightCleared]);
  const matByBatch = Object.fromEntries(materials.map((m) => [m.batchNo, m]));
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 w-[40px]">#</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">时间</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 w-[110px]">传感器</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 w-[80px]">原始值</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 w-[130px]">状态</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[320px]">
              传感器日志 · 原始说法
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[220px]">
              追溯材料小包
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l, idx) => {
            const mat = l.materialBatchNo ? matByBatch[l.materialBatchNo] : undefined;
            const hl = highlightLogId === l.id;
            return (
              <tr
                key={l.id}
                ref={hl ? highlightRef : null}
                className={cn(
                  'border-b border-slate-100 transition-colors',
                  l.status === 'anomaly' && 'bg-red-50/60 hover:bg-red-50',
                  l.status === 'gap' && 'bg-amber-50/60 hover:bg-amber-50',
                  l.status === 'normal' && 'hover:bg-slate-50',
                  hl && '!bg-yellow-100 ring-2 ring-yellow-400 ring-inset'
                )}
              >
                <td className="px-3 py-2 text-slate-400 tabular-nums">{idx + 1}</td>
                <td className="px-3 py-2 tabular-nums text-slate-700 whitespace-nowrap">
                  {formatDateTime(l.timestamp)}
                </td>
                <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{l.sensorId}</td>
                <td className="px-3 py-2 tabular-nums font-mono">
                  {l.status === 'gap' ? (
                    <span className="text-amber-600 italic">— 无采样 —</span>
                  ) : (
                    <span
                      className={cn(
                        l.status === 'anomaly' && 'text-red-700 font-semibold text-[13px]'
                      )}
                    >
                      {l.rawValue.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <LogStatusBadge status={l.status} type={l.anomalyType} />
                </td>
                <td className="px-3 py-2 text-slate-600 italic leading-relaxed">
                  <span className="text-slate-400 not-italic mr-1">[原始]</span>
                  {l.rawDescription}
                </td>
                <td className="px-3 py-2">
                  {mat ? (
                    <div className="flex items-start gap-1.5 text-[11px]">
                      <Package size={12} className="mt-0.5 text-blue-600 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">{mat.name}</div>
                        <div className="text-slate-500 font-mono">批次 {mat.batchNo}</div>
                        <div className="text-slate-500">入库号 {mat.inboundNo}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Link2 size={12} className="opacity-50" />
                      <span>未关联材料（缺料）</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {logs.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                暂无传感器日志
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
