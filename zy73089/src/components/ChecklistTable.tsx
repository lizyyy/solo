import { useMemo } from 'react';
import { FileCheck, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';
import { statusLabel } from '@/utils/diff';
import type { ChecklistItem } from '@/shared/types';

export function ChecklistTable() {
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const components = useChecklistStore((s) => s.modelComponents);
  const visaForms = useChecklistStore((s) => s.visaForms);
  const materials = useChecklistStore((s) => s.materialSubmissions);
  const selectedItemId = useUiStore((s) => s.selectedItemId);
  const selectItemId = useUiStore((s) => s.selectItemId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const filters = useUiStore((s) => s.filters);
  const timelineDate = useUiStore((s) => s.timelineDate);

  const batch = currentBatchId ? batches[currentBatchId] : null;

  const visibleItems = useMemo(() => {
    if (!batch) return [] as ChecklistItem[];
    let list = batch.items.slice();
    if (filters.componentIds.length) {
      list = list.filter((i) => filters.componentIds.includes(i.componentId));
    }
    if (filters.statuses.length) {
      list = list.filter((i) => filters.statuses.includes(i.matchStatus));
    }
    if (filters.visaNos.length) {
      list = list.filter((i) => {
        if (!i.visaFormId) return false;
        const v = visaForms[i.visaFormId];
        return v && filters.visaNos.some((n) => v.visaNo.includes(n));
      });
    }
    if (filters.materialBatchNos.length) {
      list = list.filter((i) => {
        if (!i.materialId) return false;
        const m = materials[i.materialId];
        return m && filters.materialBatchNos.some((n) => m.batchNo.includes(n));
      });
    }
    if (timelineDate) {
      const td = new Date(timelineDate).getTime();
      list = list.filter((i) => {
        const v = i.visaFormId ? visaForms[i.visaFormId] : null;
        const m = i.materialId ? materials[i.materialId] : null;
        const vd = v?.issueDate ? new Date(v.issueDate).getTime() : Infinity;
        const md = m?.submitDate ? new Date(m.submitDate).getTime() : Infinity;
        return vd <= td || md <= td;
      });
    }
    return list;
  }, [batch, filters, timelineDate, visaForms, materials]);

  if (!batch) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 text-slate-400">
        <FileCheck className="mb-3 h-10 w-10 opacity-60" />
        <p className="text-sm">尚未选择批次</p>
        <p className="mt-1 text-xs text-slate-400">从主页新建批次，或先去样例页一键载入样例</p>
      </div>
    );
  }

  const issuesByItem: Record<string, number> = {};
  const blockingByItem: Record<string, boolean> = {};
  batch.issues.forEach((iss) => {
    issuesByItem[iss.itemId] = (issuesByItem[iss.itemId] || 0) + 1;
    if (iss.blocksFinalReport) blockingByItem[iss.itemId] = true;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div>
          <div className="text-sm font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            交底清单 · {batch.batchId}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {batch.name} · {batch.runType === 'rerun' ? '重跑' : '首次'} · 共 {batch.items.length} 项，
            当前显示 {visibleItems.length} 项 · 疑点 {batch.issues.length} 条
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
            已对齐{' '}
            {batch.items.filter((i) => i.matchStatus === 'matched').length}
          </span>
          <span className="rounded bg-orange-50 px-2 py-0.5 text-orange-700">
            口径对不上{' '}
            {batch.items.filter((i) => i.matchStatus === 'mismatched').length}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
            资料不齐 {batch.items.filter((i) => i.matchStatus === 'pending').length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 w-10"></th>
              <th className="border-b border-slate-200 px-3 py-2">构件</th>
              <th className="border-b border-slate-200 px-3 py-2">状态</th>
              <th className="border-b border-slate-200 px-3 py-2">签证单</th>
              <th className="border-b border-slate-200 px-3 py-2">材料送审</th>
              <th className="border-b border-slate-200 px-3 py-2">施工口径</th>
              <th className="border-b border-slate-200 px-3 py-2">疑点</th>
              <th className="border-b border-slate-200 px-3 py-2 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic text-xs">
                  （当前筛选条件下无匹配项）
                </td>
              </tr>
            )}
            {visibleItems.map((it, idx) => {
              const comp = components[it.componentId];
              const visa = it.visaFormId ? visaForms[it.visaFormId] : null;
              const mat = it.materialId ? materials[it.materialId] : null;
              const isSel = selectedItemId === it.itemId;
              const isBlock = blockingByItem[it.itemId];
              const issueCnt = issuesByItem[it.itemId] || 0;
              const color =
                it.matchStatus === 'matched'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : it.matchStatus === 'mismatched'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200';
              return (
                <tr
                  key={it.itemId}
                  onClick={() => {
                    selectItemId(it.itemId);
                    selectComponent(it.componentId);
                  }}
                  className={`cursor-pointer transition-colors ${
                    isSel
                      ? 'bg-blue-50/80'
                      : idx % 2
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-slate-50/30 hover:bg-slate-50'
                  } ${isBlock ? 'bg-gradient-to-r from-orange-50 to-transparent' : ''}`}
                >
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-400 text-[10px] font-mono">
                    {idx + 1}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="font-bold text-slate-800">{comp?.name || it.componentId}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{it.componentId}</div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${color}`}>
                      {statusLabel[it.matchStatus]}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    {visa ? (
                      <>
                        <div className="font-mono text-[10.5px] text-slate-700">{visa.visaNo.slice(0, 22)}</div>
                        <div className="text-[9.5px] text-slate-400">
                          {visa.issueDate} · {visa.sourceFile}
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">— 无 —</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    {mat ? (
                      <>
                        <div className="font-mono text-[10.5px] text-slate-700">{mat.batchNo.slice(0, 22)}</div>
                        <div className="text-[9.5px] text-slate-400">
                          {mat.submitDate} · {mat.materialName}
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">— 无 —</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-[10.5px] text-slate-600">
                    <span className="line-clamp-2">{it.constructionStandard}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    {issueCnt > 0 ? (
                      <div
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
                          isBlock
                            ? 'bg-red-50 text-red-700 font-bold'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {isBlock ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {issueCnt} 条{isBlock && ' · 暂缓报告'}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-1 py-2 text-slate-300">
                    <ChevronRight className="h-3.5 w-3.5" />
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
