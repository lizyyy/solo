import { useMemo, useState } from 'react';
import { GitCompare, ArrowRightLeft, X } from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import { compareBatches } from '@/utils/diff';
import { statusLabel } from '@/utils/diff';
import type { ChecklistItem } from '@/shared/types';

export function BatchDiff() {
  const allBatches = useChecklistStore((s) => s.getAllBatchesSorted());
  const [leftId, setLeftId] = useState<string | ''>('');
  const [rightId, setRightId] = useState<string | ''>('');

  const batches = useChecklistStore((s) => s.batches);
  const left = leftId ? batches[leftId] : null;
  const right = rightId ? batches[rightId] : null;

  const result = useMemo(() => {
    if (!left || !right) return null;
    return compareBatches(left, right);
  }, [left, right]);

  const fieldLabel: Partial<Record<keyof ChecklistItem | 'status', string>> & Record<string, string> = {
    visaFormId: '签证单',
    materialId: '材料送审',
    constructionStandard: '施工口径',
    matchStatus: '比对状态',
    remarks: '备注',
    componentId: '构件',
    batchId: '批次',
    itemId: '条目ID',
    status: '状态',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-indigo-500" />
        <span className="text-sm font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          前后批次对照
        </span>
        <span className="text-[10px] text-slate-400">（选择两个批次并排比对差异）</span>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr] md:items-end">
        <div>
          <div className="mb-1 text-[11px] text-slate-500">较早批次</div>
          <select
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
          >
            <option value="">-- 选择 --</option>
            {allBatches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchId} · {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-center">
          <ArrowRightLeft className="h-5 w-5 text-slate-400" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-500">较晚批次</div>
          <select
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
          >
            <option value="">-- 选择 --</option>
            {allBatches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchId} · {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!result ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400 italic">
          选择两个批次开始对照。建议先去样例页导入样例，补备注重跑后再回来对比前后变化。
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="rounded-md bg-blue-50 p-2 text-blue-700">
              <div className="font-bold">{result.oldBatch.batchId}</div>
              <div className="text-[10px] text-blue-500">{result.oldBatch.name}</div>
            </div>
            <div className="rounded-md bg-indigo-50 p-2 text-indigo-700">
              <div className="font-bold">{result.newBatch.batchId}</div>
              <div className="text-[10px] text-indigo-500">{result.newBatch.name}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-1.5">构件</th>
                  <th className="px-3 py-1.5">字段</th>
                  <th className="px-3 py-1.5">旧值</th>
                  <th className="px-3 py-1.5">新值</th>
                </tr>
              </thead>
              <tbody>
                {result.addedComponents.length === 0 &&
                  result.removedComponents.length === 0 &&
                  result.changedComponents.length === 0 &&
                  result.issueChanges.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic text-xs">
                        两个批次内容完全一致（无字段变化）。
                      </td>
                    </tr>
                  )}
                {result.addedComponents.map((cid) => (
                  <tr key={`add-${cid}`} className="border-t border-emerald-100 bg-emerald-50/40">
                    <td className="px-3 py-1.5 font-bold text-emerald-700">+ {cid}</td>
                    <td colSpan={3} className="px-3 py-1.5 text-emerald-600 text-[10.5px]">
                      新增构件
                    </td>
                  </tr>
                ))}
                {result.removedComponents.map((cid) => (
                  <tr key={`del-${cid}`} className="border-t border-red-100 bg-red-50/40">
                    <td className="px-3 py-1.5 font-bold text-red-700">
                      <X className="inline h-3 w-3 mr-0.5" /> {cid}
                    </td>
                    <td colSpan={3} className="px-3 py-1.5 text-red-600 text-[10.5px]">
                      移除构件
                    </td>
                  </tr>
                ))}
                {result.changedComponents.flatMap((cid) => {
                  const diffs = result.itemDiffs[cid] || [];
                  return diffs
                    .filter((d) => d.changed)
                    .map((d, i) => (
                      <tr
                        key={`chg-${cid}-${i}`}
                        className="border-t border-amber-100 bg-amber-50/40"
                      >
                        <td className="px-3 py-1.5 font-bold text-amber-800">{cid}</td>
                        <td className="px-3 py-1.5 text-amber-700">{fieldLabel[d.field] || String(d.field)}</td>
                        <td className="px-3 py-1.5 text-slate-600 font-mono line-through opacity-80">
                          {d.oldValue || '（空）'}
                        </td>
                        <td className="px-3 py-1.5 text-slate-900 font-mono font-bold">
                          {d.newValue || '（空）'}
                        </td>
                      </tr>
                    ));
                })}
                {result.issueChanges.map((ic, i) => (
                  <tr
                    key={`iss-${i}`}
                    className="border-t border-orange-100 bg-orange-50/40"
                  >
                    <td className="px-3 py-1.5 font-bold text-orange-800">{ic.componentId}</td>
                    <td className="px-3 py-1.5 text-orange-700">疑点</td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {ic.oldCount} 条{ic.oldBlocking > 0 ? `（${ic.oldBlocking}暂缓）` : ''}
                    </td>
                    <td className="px-3 py-1.5 text-slate-900 font-bold">
                      {ic.newCount} 条{ic.newBlocking > 0 ? `（${ic.newBlocking}暂缓）` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200">
              新增 {result.addedComponents.length}
            </span>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 border border-red-200">
              移除 {result.removedComponents.length}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-200">
              字段变化 {result.changedComponents.length}
            </span>
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700 border border-orange-200">
              疑点变化 {result.issueChanges.length}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 border border-blue-200">
              比对状态标签说明：{Object.entries(statusLabel).map(([k, v]) => `${k}=${v}`).join('、')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
