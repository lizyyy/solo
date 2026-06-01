import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { HotSpotRecord, Severity } from '@/types';
import { cn } from '@/lib/utils';

const severityConfig: Record<Severity, { label: string; color: string }> = {
  critical: { label: '严重', color: 'bg-red-500/20 text-red-400' },
  warning: { label: '警告', color: 'bg-yellow-500/20 text-yellow-400' },
  normal: { label: '正常', color: 'bg-green-500/20 text-green-400' },
};

export default function RecordTable() {
  const { records, selectedRecord, selectRecord, sourcesByRecord, setSourcePopover, currentScheme, fetchRecords } = useStore();
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredRecords = records.filter((r) => {
    if (severityFilter && r.severity !== severityFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  function handleFilterChange() {
    const filters: { severity?: string; status?: string } = {};
    const sev = severityFilter || undefined;
    const sta = statusFilter || undefined;
    if (sev) filters.severity = sev;
    if (sta) filters.status = sta;
    if (currentScheme) {
      fetchRecords(currentScheme.id, filters);
    }
  }

  const isCoordInconsistent = (r: HotSpotRecord) =>
    currentScheme && r.coordinateSystem !== currentScheme.coordinateSystem;

  function handleTempHover(e: React.MouseEvent, recordId: string) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSourcePopover({ recordId, x: rect.right + 8, y: rect.top });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 pb-3">
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setTimeout(handleFilterChange, 0); }}
          className="rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1 text-xs text-gray-300"
        >
          <option value="">全部严重程度</option>
          <option value="normal">normal</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setTimeout(handleFilterChange, 0); }}
          className="rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1 text-xs text-gray-300"
        >
          <option value="">全部状态</option>
          <option value="active">active</option>
          <option value="resolved">resolved</option>
          <option value="conflict">conflict</option>
        </select>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-left text-gray-400">
              <th className="px-2 py-2 font-medium">名称</th>
              <th className="px-2 py-2 font-medium">温度(°C)</th>
              <th className="px-2 py-2 font-medium">坐标系</th>
              <th className="px-2 py-2 font-medium">严重程度</th>
              <th className="px-2 py-2 font-medium">状态</th>
              <th className="px-2 py-2 font-medium">来源数</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r) => (
              <tr
                key={r.id}
                onClick={() => selectRecord(r)}
                className={cn(
                  'cursor-pointer border-b border-gray-800 transition-colors',
                  selectedRecord?.id === r.id
                    ? 'bg-amber-500/10'
                    : 'hover:bg-gray-800/50',
                  isCoordInconsistent(r) && 'border-l-2 border-l-blue-500 border-dashed',
                )}
              >
                <td className="px-2 py-2 text-gray-200">{r.name}</td>
                <td className="px-2 py-2">
                  <span
                    className="group relative inline-flex items-center text-gray-200"
                    onMouseEnter={(e) => handleTempHover(e, r.id)}
                    onMouseLeave={() => setSourcePopover(null)}
                  >
                    {r.temperature.toFixed(1)}
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </td>
                <td className="px-2 py-2 text-gray-400">{r.coordinateSystem}</td>
                <td className="px-2 py-2">
                  <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', severityConfig[r.severity].color)}>
                    {severityConfig[r.severity].label}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className="inline-flex items-center gap-1 text-gray-300">
                    {r.status === 'conflict' && <AlertTriangle size={12} className="text-red-400" />}
                    {r.status}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-700 px-1.5 text-[10px] text-gray-300">
                    {sourcesByRecord[r.id]?.length ?? 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
