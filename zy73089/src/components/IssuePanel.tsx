import { useMemo } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, ShieldAlert, Search, Fingerprint } from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';

const ISSUE_LABELS: Record<string, string> = {
  coordinate_offset: '模型坐标偏移',
  material_mismatch: '施工口径对不上',
  other: '其他疑点',
};

export function IssuePanel() {
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const components = useChecklistStore((s) => s.modelComponents);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const selectedItemId = useUiStore((s) => s.selectedItemId);
  const open = useUiStore((s) => s.issuePanelOpen);
  const setOpen = useUiStore((s) => s.setIssuePanelOpen);

  const batch = currentBatchId ? batches[currentBatchId] : null;
  const item =
    selectedItemId && batch ? batch.items.find((i) => i.itemId === selectedItemId) : null;
  const cid = selectedComponentId || item?.componentId;
  const currentItemId = item?.itemId;

  const visibleIssues = useMemo(() => {
    if (!batch) return [];
    return batch.issues
      .map((iss) => {
        const compId = batch.items.find((i) => i.itemId === iss.itemId)?.componentId;
        return { iss, compId };
      })
      .filter(({ compId }) => !cid || compId === cid);
  }, [batch, cid]);

  const anyBlocking = visibleIssues.some(({ iss }) => iss.blocksFinalReport);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50/60 to-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-orange-100 bg-orange-50/70 px-4 py-2.5 text-left hover:bg-orange-50"
      >
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-bold text-orange-900" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            疑点 / 暂缓 / 原因
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            anyBlocking
              ? 'bg-red-100 text-red-700'
              : visibleIssues.length
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
          }`}>
            {visibleIssues.length} 条
            {anyBlocking && ' · 阻止最终报告'}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-orange-500" /> : <ChevronDown className="h-4 w-4 text-orange-500" />}
      </button>

      {open && (
        <div className="flex-1 space-y-3 overflow-auto p-3">
          {anyBlocking && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[11px] text-red-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <div>
                <div className="font-bold">本批次存在坐标偏移类疑点，已自动阻止进入最终报告流程。</div>
                <div className="mt-0.5 text-[10px] text-red-600">
                  请先复核坐标，或补充说明后"补备注重跑"生成新批次。
                </div>
              </div>
            </div>
          )}

          {visibleIssues.length === 0 && (
            <div className="py-4 text-center text-[11px] text-slate-400 italic">
              {cid ? '当前选中构件暂无疑点。' : '本批次暂无疑点。'}
            </div>
          )}

          {visibleIssues.map(({ iss, compId }) => {
            const comp = compId ? components[compId] : null;
            const colorCls = iss.blocksFinalReport
              ? 'border-red-300 bg-red-50/60'
              : 'border-amber-300 bg-amber-50/60';
            return (
              <div
                key={iss.issueId}
                className={`rounded-xl border p-3 shadow-sm ${colorCls} ${
                  currentItemId === iss.itemId ? 'ring-2 ring-blue-400' : ''
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        iss.blocksFinalReport
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {ISSUE_LABELS[iss.issueType] || iss.issueType}
                    </span>
                    {comp && (
                      <span className="text-[11px] font-bold text-slate-700">{comp.name}</span>
                    )}
                    {comp && (
                      <span className="font-mono text-[10px] text-slate-500">{comp.id}</span>
                    )}
                  </div>
                  {iss.blocksFinalReport && (
                    <span className="rounded-full border border-red-400 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      ✋ 暂缓报告
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="rounded-md bg-white p-2 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-orange-700">
                      <Search className="h-3 w-3" /> 疑点说明
                    </div>
                    <div className="text-[11.5px] leading-relaxed text-slate-800">
                      {iss.description}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-2 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-indigo-700">
                      <Fingerprint className="h-3 w-3" /> 数据来源
                    </div>
                    <div className="font-mono text-[10.5px] leading-relaxed text-slate-700 break-words">
                      {iss.sourceEvidence}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-2 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-red-700">
                      <ShieldAlert className="h-3 w-3" /> 暂缓原因
                    </div>
                    <div className="text-[11.5px] leading-relaxed text-slate-800">
                      {iss.holdReason}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
