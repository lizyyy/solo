import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { runAllChecks, summarizeExceptions, hasException } from '@/utils/detector';
import ExceptionBadge from '@/components/exception/ExceptionBadge';
import type { SparePart } from '@/types';

interface SparePartTableProps {
  parts: SparePart[];
}

const MATERIAL_STATUS_COLOR: Record<string, string> = {
  正常: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  缺料: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  待核: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  单位异常: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  阈值异常: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  公式异常: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

export default function SparePartTable({ parts }: SparePartTableProps) {
  const partsWithChecks = useMemo(() => {
    return parts.map(p => ({
      part: p,
      check: runAllChecks(p),
    }));
  }, [parts]);

  if (parts.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        暂无备件数据
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
                备件名
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                编码
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                规格
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                单位
              </th>
              <th className="table-cell text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                申报数
              </th>
              <th className="table-cell text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                出库数
              </th>
              <th className="table-cell text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                单价
              </th>
              <th className="table-cell text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                金额
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                标记
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                状态
              </th>
              <th className="table-cell text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                撤回
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/70">
            {partsWithChecks.map(({ part, check }) => {
              const isException = hasException(check);
              const exceptionMsgs = summarizeExceptions(check);
              const amount = (part.req_qty || 0) * (part.price || 0);
              return (
                <tr
                  key={part.id}
                  className={cn(
                    'transition-colors',
                    isException && 'bg-rose-500/5',
                    part.is_temp && !isException && 'bg-violet-500/5',
                    'hover:bg-slate-800/40',
                  )}
                >
                  <td className="table-cell text-slate-200">
                    <div className="flex flex-col">
                      <span>{part.part_name}</span>
                      {isException && exceptionMsgs.map((msg, i) => (
                        <span key={i} className="text-xs text-rose-400 mt-0.5">
                          {msg}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell font-mono text-slate-400 text-xs">
                    {part.part_code || '-'}
                  </td>
                  <td className="table-cell text-slate-400 text-xs">
                    {part.spec || '-'}
                  </td>
                  <td className="table-cell text-slate-300">
                    {part.unit}
                  </td>
                  <td className="table-cell text-right font-mono text-slate-300">
                    {part.req_qty}
                  </td>
                  <td className="table-cell text-right font-mono text-slate-300">
                    {part.act_qty}
                  </td>
                  <td className="table-cell text-right font-mono text-slate-300">
                    ¥{part.price?.toFixed(2)}
                  </td>
                  <td className="table-cell text-right font-mono text-slate-200 font-medium">
                    ¥{amount.toFixed(2)}
                  </td>
                  <td className="table-cell">
                    {part.is_temp ? (
                      <span className="badge border-violet-500 bg-violet-500/10 text-violet-300">
                        临时材料
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span
                      className={cn(
                        'badge border',
                        MATERIAL_STATUS_COLOR[part.material_status] ||
                          'bg-slate-500/20 text-slate-300 border-slate-500/40',
                      )}
                    >
                      {part.material_status}
                    </span>
                  </td>
                  <td className="table-cell">
                    <ExceptionBadge recall_tag={part.recall_tag} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
