import { useMemo } from 'react';
import { FileText, FolderOpen, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';
import { formatCoord } from '@/utils/coordinateValidator';

export function SourcePanel() {
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const visaForms = useChecklistStore((s) => s.visaForms);
  const materials = useChecklistStore((s) => s.materialSubmissions);
  const components = useChecklistStore((s) => s.modelComponents);

  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const selectedItemId = useUiStore((s) => s.selectedItemId);
  const open = useUiStore((s) => s.sourcePanelOpen);
  const setOpen = useUiStore((s) => s.setSourcePanelOpen);

  const batch = currentBatchId ? batches[currentBatchId] : null;
  const item =
    selectedItemId && batch ? batch.items.find((i) => i.itemId === selectedItemId) : null;
  const cid = selectedComponentId || item?.componentId;

  const visa = useMemo(
    () => (cid ? Object.values(visaForms).find((v) => v.componentId === cid) : null),
    [cid, visaForms],
  );
  const mat = useMemo(
    () => (cid ? Object.values(materials).find((m) => m.componentId === cid) : null),
    [cid, materials],
  );
  const comp = cid ? components[cid] : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            原始来源
          </span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-600">
            保留脏数据 · 不清洗
          </span>
          {!cid && <span className="text-[10px] text-slate-400 italic">（点选构件或清单行查看）</span>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && cid && (
        <div className="flex-1 space-y-3 overflow-auto p-3">
          {comp && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-1.5 text-[11px] font-bold text-slate-700">构件</div>
              <div className="text-sm font-bold text-slate-800">{comp.name}</div>
              <div className="mt-1 text-[10px] text-slate-500 font-mono">
                {comp.id} · {comp.type} · 模型坐标 {formatCoord(comp.position)}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-blue-800">
              <FileText className="h-3.5 w-3.5" /> 现场签证单（原始）
            </div>
            {visa ? (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold font-mono text-slate-800">{visa.visaNo}</div>
                    <div className="text-[10px] text-slate-500">
                      签发日期：{visa.issueDate} · 来源：{visa.sourceFile}
                    </div>
                  </div>
                  <div className="rounded border border-blue-200 bg-white px-2 py-0.5 text-[10px] text-blue-700 font-mono">
                    坐标 {formatCoord(visa.rawCoordinates)}
                  </div>
                </div>
                <div className="relative rounded-md border border-dashed border-blue-200 bg-white p-3">
                  <div className="absolute -top-2 left-2 bg-blue-50 px-1 text-[9px] text-blue-500 tracking-widest">
                    ⚠ 原始内容 · 未清洗
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-slate-700">
                    {visa.rawContent}
                  </pre>
                </div>
                {/涂改|缺失|模糊|潦草|疑似|磨损/.test(visa.visaNo + visa.rawContent) && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>
                      检测到脏数据标记：编号涂改/字迹模糊/信息缺失等。本系统保留原始内容，
                      不会自动修正。
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="py-3 text-center text-[11px] text-slate-400 italic">
                （该构件暂无签证单）
              </div>
            )}
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
              <FileText className="h-3.5 w-3.5" /> 材料送审单（原始）
            </div>
            {mat ? (
              <>
                <div className="mb-2">
                  <div className="text-xs font-bold font-mono text-slate-800">{mat.batchNo}</div>
                  <div className="text-[10px] text-slate-500">
                    {mat.materialName} · {mat.specification}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    送审日期：{mat.submitDate} · 来源：{mat.sourceFile}
                  </div>
                </div>
                <div className="relative rounded-md border border-dashed border-emerald-200 bg-white p-3">
                  <div className="absolute -top-2 left-2 bg-emerald-50 px-1 text-[9px] text-emerald-600 tracking-widest">
                    ⚠ 原始内容 · 未清洗
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-slate-700">
                    {mat.rawContent}
                  </pre>
                </div>
                {/磨损|不清|不符|待确认/.test(mat.batchNo + mat.specification + mat.rawContent) && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>检测到批号磨损或规格"待确认"标记。系统原样保留，不会自行推断。</span>
                  </div>
                )}
              </>
            ) : (
              <div className="py-3 text-center text-[11px] text-slate-400 italic">
                （该构件暂无材料送审单）
              </div>
            )}
          </div>
        </div>
      )}

      {open && !cid && (
        <div className="p-4 text-center text-[11px] text-slate-400 italic">
          在左侧 3D 模型中点选构件，或在上侧清单中选一行，即可查看该构件的原始签证单与材料送审单。
        </div>
      )}
    </div>
  );
}
