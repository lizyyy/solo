import { useMemo } from "react";
import { ClipboardPlus } from "lucide-react";
import { useStore } from "@/store/useStore";

interface ManualSupplementListProps {
  eventId: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-[#e8a838]/20", text: "text-[#e8a838]", label: "待处理" },
  resolved: { bg: "bg-[#2dd4a8]/20", text: "text-[#2dd4a8]", label: "已解决" },
};

export default function ManualSupplementList({ eventId }: ManualSupplementListProps) {
  const allSupplements = useStore((s) => s.manualSupplements);
  const supplements = useMemo(() => allSupplements.filter((s) => s.eventId === eventId), [allSupplements, eventId]);

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardPlus className="w-4 h-4 text-[#e8a838]" />
        <span className="text-[#f0ece4] font-medium text-sm">人工补资料</span>
      </div>

      {supplements.length === 0 && (
        <p className="text-[#6b7894] text-xs">暂无人工补资料记录</p>
      )}

      <div className="space-y-2">
        {supplements.map((sup) => {
          const statusStyle = STATUS_STYLES[sup.status];
          const isPending = sup.status === "pending";

          return (
            <div
              key={sup.id}
              className={`bg-[#0f1225] border border-[#2a3050] rounded p-3 space-y-1.5 ${
                isPending ? "border-l-4 border-l-[#e8a838]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#f0ece4] text-xs font-medium">
                    {sup.supplementType}
                  </span>
                  <span
                    className={`${statusStyle.bg} ${statusStyle.text} text-xs px-2 py-0.5 rounded`}
                  >
                    {statusStyle.label}
                  </span>
                </div>
              </div>

              <p className="text-[#6b7894] text-xs">{sup.description}</p>

              <div className="flex items-center gap-3">
                <span className="text-[#6b7894] text-xs">
                  请求人: {sup.requestedBy}
                </span>
                <span className="text-[#6b7894] text-xs font-mono">
                  {new Date(sup.requestedAt).toLocaleString("zh-CN")}
                </span>
              </div>

              {sup.resolvedAt && (
                <div className="flex items-center gap-1">
                  <span className="text-[#2dd4a8] text-xs">已解决于</span>
                  <span className="text-[#6b7894] text-xs font-mono">
                    {new Date(sup.resolvedAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
