import { useMemo } from "react";
import { Activity, Clock, TrendingUp, ClipboardPlus } from "lucide-react";
import { useStore } from "@/store/useStore";

const cards = [
  { key: "total", label: "事件总数", icon: Activity, color: "#e8a838" },
  { key: "pendingReview", label: "待复核", icon: Clock, color: "#8b5cf6" },
  { key: "thisWeekNew", label: "本周新增", icon: TrendingUp, color: "#2dd4a8" },
  { key: "manualSupplementCount", label: "人工补资料", icon: ClipboardPlus, color: "#f59e0b" },
] as const;

export default function StatsCards() {
  const events = useStore((s) => s.events);
  const supplements = useStore((s) => s.manualSupplements);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      total: events.length,
      pendingReview: events.filter((e) => e.status === "under_review").length,
      thisWeekNew: events.filter((e) => e.createdAt >= weekAgo).length,
      manualSupplementCount: supplements.filter((s) => s.status === "pending").length,
    };
  }, [events, supplements]);

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="rounded-lg bg-[#1a1f36] p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6b7894]">{label}</span>
            <Icon size={18} style={{ color }} />
          </div>
          <span className="font-jetbrains text-3xl font-semibold text-[#f0ece4]">
            {stats[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
