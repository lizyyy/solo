import { useMemo } from 'react';
import { useWorkorderStore } from '@/store/workorderStore';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/status/StatusBadge';

export default function WorkorderTable() {
  const workorders = useWorkorderStore(s => s.workorders);
  const spare_parts = useWorkorderStore(s => s.spare_parts);
  const recall_records = useWorkorderStore(s => s.recall_records);

  const stats = useMemo(() => {
    const partCount: Record<string, number> = {};
    spare_parts.forEach(p => {
      partCount[p.workorder_id] = (partCount[p.workorder_id] || 0) + (p.req_qty || 0);
    });
    const recallCount: Record<string, number> = {};
    recall_records.forEach(r => {
      recallCount[r.workorder_id] = (recallCount[r.workorder_id] || 0) + 1;
    });
    return { partCount, recallCount };
  }, [spare_parts, recall_records]);

  if (workorders.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        暂无工单数据
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700/70">
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                工单编号
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                设备编号
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                工单类型
              </th>
              <th className="table-cell text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                备件数量
              </th>
              <th className="table-cell text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                异常数量
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                交接状态
              </th>
              <th className="table-cell text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/70">
            {workorders.map(wo => (
              <tr
                key={wo.id}
                className={cn(
                  'hover:bg-slate-800/40 transition-colors',
                  wo.is_duplicate && 'duplicate-stripe',
                )}
              >
                <td className="table-cell font-mono text-slate-200">
                  {wo.id}
                </td>
                <td className="table-cell">
                  <span
                    className={cn(
                      'font-mono',
                      wo.is_duplicate
                        ? 'bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-sm'
                        : 'text-slate-200',
                    )}
                  >
                    {wo.device_no}
                  </span>
                </td>
                <td className="table-cell text-slate-300">
                  {wo.work_type}
                </td>
                <td className="table-cell text-right text-slate-300 font-mono">
                  {stats.partCount[wo.id] || 0}
                </td>
                <td className="table-cell text-right">
                  {(stats.recallCount[wo.id] || 0) > 0 ? (
                    <span className="font-mono text-rose-400">
                      {stats.recallCount[wo.id]}
                    </span>
                  ) : (
                    <span className="font-mono text-slate-500">0</span>
                  )}
                </td>
                <td className="table-cell">
                  <StatusBadge status={wo.handover_status} />
                </td>
                <td className="table-cell text-center">
                  <button
                    onClick={() => {
                      window.location.hash = `#/workorder/${wo.id}`;
                    }}
                    className="btn-ghost text-xs px-3 py-1"
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
