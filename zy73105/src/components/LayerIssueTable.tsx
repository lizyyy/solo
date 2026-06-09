import type { LayerIssue } from '../types/review';
import {
  RESOLUTION_DIRECTION_CLASS,
  RESOLUTION_DIRECTION_LABEL,
  RESOLUTION_STATUS_LABEL,
} from '../utils/statusMappings';
import { Layers3, AlertCircle, ArrowRight } from 'lucide-react';

interface Props {
  issues: LayerIssue[];
}

export function LayerIssueTable({ issues }: Props) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
        本复核记录无图层命名异常。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-[22%]">混乱图层名称</th>
            <th className="w-[18%]">应规范命名</th>
            <th className="w-[30%]">
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle size={13} className="text-status-pending" />
                待确认原因
              </span>
            </th>
            <th className="w-[20%]">
              <span className="inline-flex items-center gap-1.5">
                <ArrowRight size={13} className="text-status-confirmed" />
                处理去向
              </span>
            </th>
            <th className="w-[10%] text-right">进度</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((iss, idx) => (
            <tr
              key={iss.id}
              className="animate-fade-in-stagger"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <td>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-status-layer/10 text-status-layer">
                    <Layers3 size={14} />
                  </div>
                  <span className="mono font-semibold text-status-layer text-sm">
                    {iss.messyLayerName}
                  </span>
                </div>
              </td>
              <td>
                <span className="mono rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                  {iss.expectedStandard}
                </span>
              </td>
              <td className="text-sm text-slate-700 leading-relaxed pr-6">
                {iss.confirmReason}
              </td>
              <td>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${RESOLUTION_DIRECTION_CLASS[iss.resolutionDirection]}`}
                >
                  {RESOLUTION_DIRECTION_LABEL[iss.resolutionDirection]}
                </span>
              </td>
              <td className="text-right">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    iss.resolutionStatus === 'pending'
                      ? 'bg-status-pending-bg text-status-pending'
                      : 'bg-status-confirmed-bg text-status-confirmed'
                  }`}
                >
                  {RESOLUTION_STATUS_LABEL[iss.resolutionStatus]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
