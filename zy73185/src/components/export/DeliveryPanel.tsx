import { useState } from "react";
import { Copy, Download, Check, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { copyToClipboard, downloadText } from "@/utils/export";

export default function DeliveryPanel() {
  const { runs, currentRunId, currentAnomalies, globalSummary, exportMarkdown, loading } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentRun = runs.find((r) => r.id === currentRunId);
  const disabled = !currentRun || loading || busy;

  const unresolved = currentAnomalies.filter((a) => !a.resolved).length;

  const fetchMd = async () => {
    if (!currentRun) return "";
    setBusy(true);
    try {
      return await exportMarkdown(currentRun.id);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const md = await fetchMd();
    if (!md) return;
    const ok = await copyToClipboard(md);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = async () => {
    const md = await fetchMd();
    if (!md) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`误差传播批量验算-交付摘要-${stamp}.md`, md);
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg border border-fog-200 bg-white text-xs text-ink-600 max-h-[180px] overflow-y-auto scroll-thin">
        <div className="space-y-1 font-mono text-[11px] leading-relaxed">
          <div className="flex items-center justify-between">
            <span className="label">当前运行</span>
            <span>{currentRun ? currentRun.validDraftIds.length + " 有效" : "—"}</span>
          </div>
          <div className="h-px bg-fog-200 my-1" />
          <div className="flex items-center justify-between">
            <span className="label">处理记录</span>
            <span>{runs.length} 次</span>
          </div>
          <div className="h-px bg-fog-200 my-1" />
          <div className="flex items-center justify-between">
            <span className="label">页面摘要</span>
            <span>{unresolved} 项未解决</span>
          </div>
          <div className="h-px bg-fog-200 my-1" />
          <p className="text-[11px] text-ink-500 pt-1 whitespace-pre-wrap break-words">
            {globalSummary}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="btn-primary flex-1 disabled:opacity-50"
          disabled={disabled}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "已复制" : busy ? "生成中" : "复制摘要"}
        </button>
        <button
          onClick={handleDownload}
          className="btn-secondary flex-1 disabled:opacity-50"
          disabled={disabled}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "生成中" : "下载 .md"}
        </button>
      </div>

      <p className="text-[11px] text-ink-400">
        阿宁可将此摘要直接对给他人查看：草稿 · 处理记录 · 摘要三合一
      </p>
    </div>
  );
}
