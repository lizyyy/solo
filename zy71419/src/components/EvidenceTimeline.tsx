import { useMemo } from "react";
import {
  FileText,
  Megaphone,
  Vote,
  Calculator,
  ClipboardPlus,
  ArrowRightLeft,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { EVIDENCE_NODE_LABELS } from "@/types";
import type { EvidenceNodeType } from "@/types";

interface EvidenceTimelineProps {
  eventId: string;
}

const NODE_ICONS: Record<EvidenceNodeType, React.ElementType> = {
  contract: FileText,
  announcement: Megaphone,
  vote: Vote,
  payout: Calculator,
  manual_supplement: ClipboardPlus,
  status_change: ArrowRightLeft,
};

const NODE_COLORS: Record<EvidenceNodeType, string> = {
  contract: "#3b82f6",
  announcement: "#8b5cf6",
  vote: "#06b6d4",
  payout: "#f59e0b",
  manual_supplement: "#e8a838",
  status_change: "#6b7280",
};

export default function EvidenceTimeline({ eventId }: EvidenceTimelineProps) {
  const allNodes = useStore((s) => s.evidenceNodes);
  const nodes = useMemo(
    () => allNodes.filter((e) => e.eventId === eventId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [allNodes, eventId]
  );

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg p-4">
      <h3 className="text-[#f0ece4] font-medium text-sm mb-4">证据链</h3>

      {nodes.length === 0 && (
        <p className="text-[#6b7894] text-xs">暂无证据节点</p>
      )}

      <div className="space-y-0">
        {nodes.map((node, index) => {
          const Icon = NODE_ICONS[node.nodeType];
          const color = NODE_COLORS[node.nodeType];
          const label = EVIDENCE_NODE_LABELS[node.nodeType];
          const isLast = index === nodes.length - 1;

          return (
            <div key={node.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                {!isLast && (
                  <div
                    className="w-px flex-1 min-h-[24px]"
                    style={{
                      borderLeft: "2px dashed",
                      borderColor: "#2a3050",
                    }}
                  />
                )}
              </div>

              <div className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${color}20`,
                      color,
                    }}
                  >
                    {label}
                  </span>
                  <span className="text-[#6b7894] text-xs font-mono">
                    {new Date(node.timestamp).toLocaleString("zh-CN")}
                  </span>
                </div>
                <p className="text-[#f0ece4] text-xs leading-relaxed">
                  {node.summary}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[#6b7894] text-xs">
                    来源: {node.source}
                  </span>
                  <span className="text-[#6b7894] text-xs">
                    操作人: {node.operator}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
