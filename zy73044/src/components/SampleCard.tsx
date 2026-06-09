import { ArrowRight, FileText, Sparkles } from "lucide-react";
import StatusBadge from "./StatusBadge";
import type { SpareRecord } from "@/lib/types";

interface Props {
  sample: SpareRecord | null;
}

export default function SampleCard({ sample }: Props) {
  if (!sample) return null;
  const gap = sample.anomalies.includes("gap") && sample.gapDetail;
  return (
    <section className="relative">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-[2px] bg-[#1E40AF] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-sans font-black text-slate-800 tracking-tight text-lg">
          接班样例 <span className="text-[#1E40AF]">— 这条改了什么</span>
        </h2>
        <span className="ml-2 text-[10px] font-sans text-slate-400 tracking-widest uppercase">
          Walkthrough
        </span>
      </div>
      <div className="relative pl-6">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1E40AF] rounded-full" />
        <div className="border-2 border-slate-800 bg-white rounded-[2px] p-5 shadow-[4px_4px_0_0_rgba(30,64,175,0.15)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <code className="font-mono text-sm font-bold bg-slate-100 px-2 py-0.5 rounded-[2px] text-slate-800">
                  {sample.partNo}
                </code>
                <StatusBadge status={sample.status} size="md" />
                {sample.anomalies.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-sans rounded-[2px] bg-orange-50 text-orange-700 border border-orange-300">
                    ⚠ 异常标记：{sample.anomalies.join(" / ")}
                  </span>
                )}
              </div>
              <div className="mt-2 font-serif text-base text-slate-900">
                {sample.partDesc || <span className="text-slate-400 italic">（备件描述缺失）</span>}
              </div>
              <div className="mt-1 text-[11px] font-sans text-slate-500 font-mono">
                来源：{sample.sourceFile}
              </div>
            </div>
          </div>

          {gap ? (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
              <div className="border-2 border-slate-300 p-3 rounded-[2px] bg-slate-50">
                <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">
                  上一班值
                </div>
                <div className="font-sans text-2xl font-black text-slate-700 tabular-nums">
                  {gap.prevValue ?? <span className="text-slate-400">∅</span>}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-8 bg-[#EA580C]" />
                  <ArrowRight className="w-5 h-5 text-[#EA580C]" strokeWidth={2.5} />
                  <div className="h-0.5 w-8 bg-[#EA580C]" />
                </div>
              </div>
              <div className="border-2 border-[#EA580C] p-3 rounded-[2px] bg-orange-50">
                <div className="text-[10px] font-sans text-[#EA580C] tracking-widest uppercase mb-1">
                  当前值 · 断档
                </div>
                <div className="font-sans text-2xl font-black text-[#EA580C] tabular-nums">
                  {gap.currValue ?? <span className="text-orange-400">∅</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-300 rounded-[2px]">
              <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="font-serif text-sm text-emerald-900">
                采样值正常（当前 <b className="font-sans tabular-nums">{sample.sampling ?? "—"}</b>），与上一班无显著断档
              </div>
            </div>
          )}

          {sample.remark && (
            <div className="mt-4 p-3 border-l-4 border-slate-800 bg-slate-50 rounded-r-[2px]">
              <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">
                人工备注（已锁定，重复导入不会覆盖）
              </div>
              <div className="font-serif text-slate-800 leading-relaxed">
                {sample.remark}
              </div>
            </div>
          )}

          <details className="mt-4 group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-[11px] font-sans text-slate-500 hover:text-slate-800 tracking-wide select-none">
              <span className="w-4 text-center group-open:rotate-90 transition-transform">▸</span>
              查看备件清单原始说法
            </summary>
            <pre className="mt-2 text-[11px] font-mono bg-slate-900 text-slate-100 p-3 rounded-[2px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{sample.rawRow}
            </pre>
            {sample.rawRowHistory.length > 1 && (
              <div className="mt-2 text-[11px] font-sans text-slate-500">
                另有 <b>{sample.rawRowHistory.length - 1}</b> 条历史版本已保留，可在明细区"原始说法"中查看。
              </div>
            )}
          </details>
        </div>
      </div>
    </section>
  );
}
