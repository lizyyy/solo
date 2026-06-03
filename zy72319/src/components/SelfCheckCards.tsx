import { useState } from "react";
import { CheckCircle2, XCircle, Download, ChevronDown, ChevronUp } from "lucide-react";
import type { SelfCheckType, SelfCheckResult } from "@/types";
import useAppStore from "@/store/useAppStore";

const checkLabels: Record<SelfCheckType, string> = {
  duplicate_import: "重复导入检测",
  boundary_threshold: "边界值阈值检测",
  supplementary_recalc: "补录后重算检测",
  export_consistency: "导出一致性检测",
};

const checkOrder: SelfCheckType[] = [
  "duplicate_import",
  "boundary_threshold",
  "supplementary_recalc",
  "export_consistency",
];

function CheckCard({ result }: { result: SelfCheckResult | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!result) {
    return (
      <div className="rounded-lg border border-[#2a2a4a] bg-[#16163a] px-4 py-3">
        <p className="text-sm text-[#8888aa]">{checkLabels[checkOrder[0]]}</p>
        <p className="text-xs text-[#555] mt-1">未检测</p>
      </div>
    );
  }

  const passed = result.passed;
  const label = checkLabels[result.type];

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        passed ? "border-[#0ff0b3] bg-[#0a2a1a]" : "border-[#ff4444] bg-[#2a0a0a]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {passed ? (
            <CheckCircle2 size={18} className="text-[#0ff0b3]" />
          ) : (
            <XCircle size={18} className="text-[#ff4444]" />
          )}
          <span className="text-sm font-medium text-[#ccccdd]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              passed ? "bg-[#0ff0b3]/20 text-[#0ff0b3]" : "bg-[#ff4444]/20 text-[#ff4444]"
            }`}
          >
            {passed ? "通过" : "未通过"}
          </span>
          <button onClick={() => setExpanded(!expanded)} className="text-[#8888aa] hover:text-[#ccccdd]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1 border-t border-[#2a2a4a] pt-2">
          {result.details.map((d, i) => (
            <p key={i} className="text-xs text-[#ccccdd]">
              {d.status === "pass" ? "✓" : "✗"} {d.item}：{d.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SelfCheckCards() {
  const selfCheckResults = useAppStore((s) => s.selfCheckResults);
  const runSelfChecksNow = useAppStore((s) => s.runSelfChecksNow);
  const exportReport = useAppStore((s) => s.exportReport);
  const addToast = useAppStore((s) => s.addToast);

  const resultMap = new Map<SelfCheckType, SelfCheckResult>(
    selfCheckResults.map((r) => [r.type, r])
  );

  const handleExport = () => {
    runSelfChecksNow();
    const content = exportReport();
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `自检报告_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("success", "报告已导出");
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3">
        {checkOrder.map((type) => (
          <CheckCard key={type} result={resultMap.get(type)} />
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={runSelfChecksNow}
          className="flex items-center gap-2 rounded-lg bg-[#0ff0b3] px-4 py-2 text-sm font-semibold text-[#0d0d1f] transition-opacity hover:opacity-90"
        >
          <CheckCircle2 size={16} />
          运行自检
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-[#ff9f1c] bg-transparent px-4 py-2 text-sm font-semibold text-[#ff9f1c] transition-opacity hover:opacity-90"
        >
          <Download size={16} />
          导出报告
        </button>
      </div>
    </div>
  );
}
