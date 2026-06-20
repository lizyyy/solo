import { FileDown, FileText, Layers, Crosshair, MapPin } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SAMPLES } from "@/engine/samples";
import { downloadText } from "@/lib/download";
import { SampleCard } from "@/components/SampleCard";
import { ExceptionTable } from "@/components/ExceptionTable";

export default function Samples() {
  const exceptions = useStore((s) => s.exceptions);
  const clearExceptions = useStore((s) => s.clearExceptions);
  const exportMarkdown = useStore((s) => s.exportMarkdown);
  const exportCsv = useStore((s) => s.exportCsv);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-ash">
            attribution · samples & exceptions
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tightest text-bone">
            样例与异常
          </h1>
          <p className="mt-1 text-[12px] text-ash">
            内置典型样例一键载入；异常台账留痕拦截原因；结果可导出 Markdown / CSV。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadText("attribution-report.md", exportMarkdown(), "text/markdown;charset=utf-8")}
            className="inline-flex items-center gap-1.5 border border-amber/60 bg-amber/10 px-3 py-1.5 font-mono text-[12px] text-amber hover:bg-amber/20"
          >
            <FileText className="h-3.5 w-3.5" /> 导出 Markdown
          </button>
          <button
            onClick={() => downloadText("attribution-detail.csv", exportCsv(), "text/csv;charset=utf-8")}
            className="inline-flex items-center gap-1.5 border border-pass/50 bg-pass/10 px-3 py-1.5 font-mono text-[12px] text-pass hover:bg-pass/20"
          >
            <FileDown className="h-3.5 w-3.5" /> 导出 CSV
          </button>
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-2 border border-line bg-carbon-900/50 p-3">
          <Layers className="mt-0.5 h-4 w-4 text-amber" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ash">样例在哪</div>
            <div className="text-[12px] text-bone">下方样例库，点击「载入工作台」</div>
          </div>
        </div>
        <div className="flex items-start gap-2 border border-line bg-carbon-900/50 p-3">
          <Crosshair className="mt-0.5 h-4 w-4 text-block" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ash">异常在哪</div>
            <div className="text-[12px] text-bone">下方异常台账 + 工作台拦截卡</div>
          </div>
        </div>
        <div className="flex items-start gap-2 border border-line bg-carbon-900/50 p-3">
          <MapPin className="mt-0.5 h-4 w-4 text-pass" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ash">结果怎么导出</div>
            <div className="text-[12px] text-bone">右上「导出 Markdown / CSV」</div>
          </div>
        </div>
      </div>

      <section className="mb-5">
        <header className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber" />
          <h2 className="font-display text-sm font-bold tracking-wide text-bone">样例库</h2>
          <span className="font-mono text-[11px] text-ash">{SAMPLES.length} 个</span>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          {SAMPLES.map((s) => (
            <SampleCard key={s.id} sample={s} />
          ))}
        </div>
      </section>

      <ExceptionTable exceptions={exceptions} onClear={clearExceptions} />
    </div>
  );
}
