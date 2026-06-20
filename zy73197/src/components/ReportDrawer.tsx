import { useState } from "react";
import { X, Copy, Check, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { downloadText, copyText } from "@/lib/download";

export function ReportDrawer() {
  const open = useStore((s) => s.reportOpen);
  const toggle = useStore((s) => s.toggleReport);
  const markdown = useStore((s) => s.result.markdown);
  const exportMarkdown = useStore((s) => s.exportMarkdown);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-carbon-950/70 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => toggle(false)}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-amber/30 bg-carbon-950 transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2 w-2 animate-pulse-dot bg-amber" />
          <h2 className="font-display text-sm font-bold tracking-wide text-bone">Markdown 归因报告</h2>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => {
                copyText(markdown).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="inline-flex items-center gap-1 border border-line bg-carbon-800/50 px-2 py-1 font-mono text-[11px] text-bone hover:border-amber/40"
            >
              {copied ? <Check className="h-3 w-3 text-pass" /> : <Copy className="h-3 w-3" />}
              {copied ? "已复制" : "复制"}
            </button>
            <button
              onClick={() => downloadText("attribution-report.md", exportMarkdown(), "text/markdown;charset=utf-8")}
              className="inline-flex items-center gap-1 border border-pass/40 bg-pass/10 px-2 py-1 font-mono text-[11px] text-pass hover:bg-pass/20"
            >
              <FileDown className="h-3 w-3" /> 下载 .md
            </button>
            <button
              onClick={() => toggle(false)}
              className="grid h-7 w-7 place-items-center border border-line text-ash hover:text-bone"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-bone/90">
            {markdown}
          </pre>
        </div>

        <footer className="border-t border-line px-4 py-2 font-mono text-[10px] text-ash">
          公式 · 单位 · 边界值 · 单位换算 · 中间计算 · 来源与状态 全程留痕
        </footer>
      </aside>
    </>
  );
}
