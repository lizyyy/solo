import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import {
  buildDeliveryMarkdown,
  copyToClipboard,
  downloadText,
} from "@/utils/export";

export default function DeliveryPanel() {
  const {
    drafts,
    runs,
    paramVersions,
    currentAnomalies,
    globalSummary,
  } = useAppStore();
  const [copied, setCopied] = useState(false);
  const disabled = drafts.length === 0;

  const buildMd = () =>
    buildDeliveryMarkdown({
      drafts,
      runs,
      paramVersions,
      currentAnomalies,
      globalSummary,
    });

  const handleCopy = async () => {
    const ok = await copyToClipboard(buildMd());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`误差传播批量验算-交付摘要-${stamp}.md`, buildMd());
  };

  const unresolved = currentAnomalies.filter((a) => !a.resolved).length;

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg border border-fog-200 bg-white text-xs text-ink-600 max-h-[180px] overflow-y-auto scroll-thin">
        <div className="space-y-1 font-mono text-[11px] leading-relaxed">
          <div className="flex items-center justify-between">
            <span className="label">学生草稿</span>
            <span>{drafts.length} 条</span>
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
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "已复制" : "复制摘要"}
        </button>
        <button
          onClick={handleDownload}
          className="btn-secondary flex-1 disabled:opacity-50"
          disabled={disabled}
        >
          <Download size={14} />
          下载 .md
        </button>
      </div>

      <p className="text-[11px] text-ink-400">
        阿宁可将此摘要直接对给他人查看：草稿 · 处理记录 · 摘要三合一
      </p>
    </div>
  );
}
