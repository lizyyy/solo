import { useState } from "react";
import { ChevronDown, ChevronRight, Edit3, Undo2 } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import type { FeatureSpec } from "../../shared/types";

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  consistent: { label: "一致", color: "text-green-400", bg: "bg-green-500/10" },
  inconsistent: { label: "不一致", color: "text-red-400", bg: "bg-red-500/10" },
  pending: { label: "待确认", color: "text-amber-400", bg: "bg-amber-500/10" },
};

function getStatusKey(f: FeatureSpec) {
  if (f.isConsistent === true) return "consistent";
  if (f.isConsistent === false) return "inconsistent";
  return "pending";
}

interface FeatureTableProps {
  onCorrect: (feature: FeatureSpec) => void;
  onRollback: (feature: FeatureSpec) => void;
}

export default function FeatureTable({ onCorrect, onRollback }: FeatureTableProps) {
  const { features, loading } = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading && features.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        加载中...
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <p className="text-lg">暂无特征数据</p>
        <p className="text-sm mt-1">点击右下角导入按钮添加特征</p>
      </div>
    );
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left">
            <th className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider">
              特征名称
            </th>
            <th className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider">
              训练口径
            </th>
            <th className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider">
              线上口径
            </th>
            <th className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider">
              口径状态
            </th>
            <th className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider">
              不一致原因
            </th>
            <th className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature, idx) => {
            const statusKey = getStatusKey(feature);
            const status = statusConfig[statusKey];
            const isExpanded = expanded.has(feature.id);
            const hasBasis = feature.judgmentBasis || statusKey === "inconsistent";

            return (
              <tr
                key={feature.id}
                className={cn(
                  "border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50",
                  idx % 2 === 1 && "bg-zinc-900/50"
                )}
              >
                <td className="px-4 py-3 font-mono-display text-zinc-100 font-medium">
                  {feature.featureName}
                </td>
                <td className="px-4 py-3 font-mono-display text-zinc-300 text-xs max-w-[200px] truncate">
                  {feature.trainingSpec}
                </td>
                <td className="px-4 py-3 font-mono-display text-zinc-300 text-xs max-w-[200px] truncate">
                  {feature.onlineSpec}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "badge",
                      status.color,
                      status.bg
                    )}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 max-w-[240px]">
                  <div className="flex items-start gap-1">
                    {hasBasis && (
                      <button
                        onClick={() => toggleExpand(feature.id)}
                        className="shrink-0 mt-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <span className="truncate">
                      {feature.inconsistentReason || "—"}
                    </span>
                  </div>
                  {isExpanded && hasBasis && (
                    <div className="mt-2 p-2 bg-zinc-800 rounded text-xs text-zinc-400 border border-zinc-700">
                      <span className="text-zinc-500 font-medium">判断理由：</span>
                      {feature.judgmentBasis || "训练口径与线上口径不一致"}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onCorrect(feature)}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
                      title="修正"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {feature.version > 1 && (
                      <button
                        onClick={() => onRollback(feature)}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-purple-400 transition-colors"
                        title="撤回"
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
