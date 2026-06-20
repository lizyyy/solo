import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Download,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import type { Workorder, HandoverStatus, FullDataset } from '@/types';
import { useWorkorderStore } from '@/store/workorderStore';
import { downloadJSON } from '@/utils/exporter';
import { cn } from '@/lib/utils';
import { STATUS_COLOR_MAP, STATUS_TEXT_COLOR_MAP } from '@/constants/enums';

const FILTERABLE_STATUSES: readonly HandoverStatus[] = [
  '可放行',
  '缺材料待补',
  '异常待核',
  '待交接',
] as const;

const STATUS_ICONS = {
  可放行: CheckCircle2,
  缺材料待补: AlertTriangle,
  异常待核: AlertOctagon,
  待交接: Clock,
} as const;

interface StatusCardProps {
  status: HandoverStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}

function StatusCard({ status, count, active, onClick }: StatusCardProps) {
  const Icon = STATUS_ICONS[status];
  const colorBg = STATUS_COLOR_MAP[status];
  const textColor = STATUS_TEXT_COLOR_MAP[status];
  return (
    <button
      onClick={onClick}
      className={cn(
        'card p-4 text-left transition-all duration-150 w-full',
        active
          ? 'border-shield-400 bg-shield-500/10 shadow-glow-shield ring-1 ring-shield-400/50'
          : 'hover:border-slate-500 hover:bg-slate-800/40',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-md flex items-center justify-center shrink-0',
            colorBg + '/20',
          )}
          style={{ backgroundColor: undefined }}
        >
          <div
            className={cn('w-10 h-10 rounded-md flex items-center justify-center')}
            style={{
              backgroundColor:
                status === '可放行'
                  ? 'rgba(16,185,129,0.15)'
                  : status === '缺材料待补'
                    ? 'rgba(245,158,11,0.15)'
                    : status === '异常待核'
                      ? 'rgba(244,63,94,0.15)'
                      : 'rgba(148,163,184,0.15)',
            }}
          >
            <Icon
              className={cn(
                'w-5 h-5',
                status === '可放行'
                  ? 'text-emerald-400'
                  : status === '缺材料待补'
                    ? 'text-amber-400'
                    : status === '异常待核'
                      ? 'text-rose-400'
                      : 'text-slate-400',
              )}
            />
          </div>
        </div>
        <div className="min-w-0">
          <p className={cn('text-xs font-medium mb-0.5', textColor)}>{status}</p>
          <p className="text-2xl font-bold text-white tabular-nums">{count}</p>
        </div>
      </div>
    </button>
  );
}

interface WorkorderTableProps {
  workorders: Workorder[];
}

function WorkorderTable({ workorders }: WorkorderTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-xs">
              <th className="table-cell text-left font-medium">工单编号</th>
              <th className="table-cell text-left font-medium">设备编号</th>
              <th className="table-cell text-left font-medium">刀盘型号</th>
              <th className="table-cell text-left font-medium">作业类型</th>
              <th className="table-cell text-left font-medium">位置</th>
              <th className="table-cell text-left font-medium">日期</th>
              <th className="table-cell text-left font-medium">班组</th>
              <th className="table-cell text-left font-medium">交接状态</th>
              <th className="table-cell text-left font-medium">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {workorders.map(wo => (
              <tr
                key={wo.id}
                className={cn(
                  'transition-colors hover:bg-slate-800/30',
                  wo.is_duplicate && 'duplicate-stripe',
                )}
              >
                <td className="table-cell font-mono text-shield-300 font-medium">{wo.id}</td>
                <td className="table-cell text-slate-300">{wo.device_no}</td>
                <td className="table-cell text-slate-400">{wo.cutter_model}</td>
                <td className="table-cell">
                  <span className="badge bg-slate-800 border-slate-600 text-slate-300">
                    {wo.work_type}
                  </span>
                </td>
                <td className="table-cell text-slate-400">{wo.location}</td>
                <td className="table-cell text-slate-500">{wo.work_date}</td>
                <td className="table-cell text-slate-400">{wo.team}</td>
                <td className="table-cell">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-sm',
                      STATUS_COLOR_MAP[wo.handover_status] + '/20',
                      STATUS_TEXT_COLOR_MAP[wo.handover_status],
                    )}
                    style={{
                      backgroundColor:
                        wo.handover_status === '可放行'
                          ? 'rgba(16,185,129,0.15)'
                          : wo.handover_status === '缺材料待补'
                            ? 'rgba(245,158,11,0.15)'
                            : wo.handover_status === '异常待核'
                              ? 'rgba(244,63,94,0.15)'
                              : 'rgba(148,163,184,0.15)',
                    }}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        STATUS_COLOR_MAP[wo.handover_status],
                      )}
                    />
                    {wo.handover_status}
                  </span>
                </td>
                <td className="table-cell text-slate-500 max-w-xs truncate" title={wo.handover_note}>
                  {wo.handover_note || '—'}
                </td>
              </tr>
            ))}
            {workorders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                  暂无工单数据，请加载样例或导入 JSON
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WorkorderList() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<HandoverStatus | null>(null);
  const workorders = useWorkorderStore(s => s.workorders);
  const spareParts = useWorkorderStore(s => s.spare_parts);
  const recallRecords = useWorkorderStore(s => s.recall_records);
  const loadSampleData = useWorkorderStore(s => s.loadSampleData);
  const clearAll = useWorkorderStore(s => s.clearAll);

  const counts = useMemo(() => {
    const init: Record<HandoverStatus, number> = {
      可放行: 0,
      缺材料待补: 0,
      异常待核: 0,
      待交接: 0,
    };
    return workorders.reduce((acc, w) => {
      acc[w.handover_status] = (acc[w.handover_status] || 0) + 1;
      return acc;
    }, init);
  }, [workorders]);

  const filtered = useMemo(() => {
    if (!activeFilter) return workorders;
    return workorders.filter(w => w.handover_status === activeFilter);
  }, [workorders, activeFilter]);

  const handleExport = () => {
    const data: FullDataset = { workorders, spare_parts: spareParts, recall_records: recallRecords };
    downloadJSON(data);
  };

  const handleClear = () => {
    if (workorders.length === 0) return;
    if (confirm('确定清空所有工单数据？此操作不可撤销。')) {
      clearAll();
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">工单总览</h1>
          <p className="text-sm text-slate-400 mt-1">盾构刀盘工单回放系统</p>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {FILTERABLE_STATUSES.map(status => (
          <StatusCard
            key={status}
            status={status}
            count={counts[status] || 0}
            active={activeFilter === status}
            onClick={() => setActiveFilter(activeFilter === status ? null : status)}
          />
        ))}
      </section>

      <section className="card p-3 flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={loadSampleData}>
          <Database className="w-4 h-4" />
          加载样例数据
        </button>
        <button className="btn-ghost" onClick={handleExport} disabled={workorders.length === 0}>
          <Download className="w-4 h-4" />
          导出全量 JSON
        </button>
        <button
          className="btn-ghost hover:border-rose-500/50 hover:text-rose-300"
          onClick={handleClear}
          disabled={workorders.length === 0}
        >
          <Trash2 className="w-4 h-4" />
          清空数据
        </button>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => navigate('/import')}>
          <Upload className="w-4 h-4" />
          导入数据
        </button>
      </section>

      {activeFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">当前筛选：</span>
          <span className={cn('font-medium', STATUS_TEXT_COLOR_MAP[activeFilter])}>
            {activeFilter}
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            清除筛选
          </button>
        </div>
      )}

      <WorkorderTable workorders={filtered} />
    </div>
  );
}
