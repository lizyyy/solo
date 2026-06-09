import { X, History, FileSearch } from "lucide-react";
import { useEffect } from "react";
import type { SpareRecord } from "@/lib/types";
import StatusBadge from "./StatusBadge";

interface Props {
  open: boolean;
  record: SpareRecord | null;
  onClose: () => void;
}

export default function RawRowDrawer({ open, record, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-[640px] bg-white border-l-2 border-slate-900 z-50 transition-transform duration-300 ease-out shadow-2xl ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-900 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[2px] bg-slate-900 flex items-center justify-center">
              <FileSearch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-sans font-black text-slate-900 tracking-tight">备件清单原始说法</h3>
              <p className="text-[11px] font-sans text-slate-500 mt-0.5">这是运营主管的CSV原文，不会被任何导入改写</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-[2px] border-2 border-slate-900 bg-white hover:bg-slate-100 flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {record && (
          <div className="h-[calc(100%-66px)] overflow-y-auto">
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-sm font-bold bg-slate-900 text-white px-2 py-0.5 rounded-[2px]">
                      {record.partNo}
                    </code>
                    <StatusBadge status={record.status} size="md" />
                  </div>
                  <div className="mt-2 font-serif text-base text-slate-900">
                    {record.partDesc || <span className="text-slate-400 italic">（备件描述缺失）</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase">来源文件</div>
                  <div className="font-mono text-sm text-slate-800 break-all max-w-[260px]">{record.sourceFile}</div>
                </div>
              </div>

              <div className="border-2 border-[#EA580C] rounded-[2px] overflow-hidden bg-orange-50/30">
                <div className="px-3 py-2 bg-[#EA580C] text-white font-sans text-xs tracking-wider uppercase flex items-center gap-2">
                  <History className="w-3.5 h-3.5" />
                  当前导入的原始行（第1版）
                </div>
                <pre className="p-4 text-[12px] font-mono leading-relaxed text-slate-900 whitespace-pre-wrap break-all">
{record.rawRow}
                </pre>
              </div>

              {record.rawRowHistory.length > 1 && (
                <div className="space-y-3">
                  <div className="text-[11px] font-sans text-slate-500 tracking-widest uppercase flex items-center gap-2">
                    <History className="w-3.5 h-3.5" />
                    历史版本 · 共 {record.rawRowHistory.length} 版（保留用于追责与对比）
                  </div>
                  {record.rawRowHistory.slice(0, -1).map((row, i) => (
                    <div key={i} className="border-2 border-slate-300 rounded-[2px] overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-100 font-sans text-[11px] text-slate-600 tracking-wide">
                        版本 #{record.rawRowHistory.length - i}
                      </div>
                      <pre className="p-3 text-[11px] font-mono leading-relaxed text-slate-700 whitespace-pre-wrap break-all bg-white">
{row}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {record.gapDetail && (
                <div className="border-2 border-[#EA580C] rounded-[2px] p-4 bg-orange-50">
                  <div className="text-[11px] font-sans text-[#EA580C] tracking-widest uppercase mb-2 font-bold">
                    采样断档 · 对比
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-slate-300 rounded-[2px]">
                      <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">上一班值</div>
                      <div className="font-sans text-2xl font-black text-slate-800 tabular-nums">
                        {record.gapDetail.prevValue ?? <span className="text-slate-400">空</span>}
                      </div>
                    </div>
                    <div className="p-3 bg-white border-2 border-[#EA580C] rounded-[2px]">
                      <div className="text-[10px] font-sans text-[#EA580C] tracking-widest uppercase mb-1">当前值 · 跳变</div>
                      <div className="font-sans text-2xl font-black text-[#EA580C] tabular-nums">
                        {record.gapDetail.currValue ?? <span className="text-orange-400">空</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t-2 border-slate-200 space-y-2">
                <div>
                  <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">人工备注（锁定 · 永不覆盖）</div>
                  <div className="font-serif text-sm text-slate-800 bg-slate-50 border border-slate-200 p-3 rounded-[2px] leading-relaxed">
                    {record.remark || <span className="text-slate-400 italic">（尚无备注，可在明细区编辑）</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">导入批次</div>
                    <div className="font-mono text-xs text-slate-800">{record.sourceBatch}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">采样值</div>
                    <div className="font-mono text-xs text-slate-800 tabular-nums">
                      {record.sampling ?? "（空）"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
