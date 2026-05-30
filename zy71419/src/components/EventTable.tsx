import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { EventStatus } from "@/types";

export default function EventTable() {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.statusFilter !== "all" && e.status !== filters.statusFilter) return false;
      if (filters.productFilter !== "all" && e.productType !== filters.productFilter) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        return (
          e.id.toLowerCase().includes(q) ||
          e.eventName.toLowerCase().includes(q) ||
          e.referenceEntity.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, filters]);

  const formatDate = (iso: string) => iso.slice(0, 10);

  return (
    <div className="rounded-lg bg-[#1a1f36] overflow-hidden">
      <table className="w-full text-sm text-[#f0ece4]">
        <thead>
          <tr className="border-b border-[#3b4263] text-left text-xs text-[#6b7894]">
            <th className="px-4 py-3 font-medium">事件编号</th>
            <th className="px-4 py-3 font-medium">事件名称</th>
            <th className="px-4 py-3 font-medium">产品类型</th>
            <th className="px-4 py-3 font-medium">标的实体</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">创建时间</th>
            <th className="px-4 py-3 font-medium">人工补资料</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((event) => (
            <tr
              key={event.id}
              className="border-b border-[#252b47] cursor-pointer hover:bg-[#252b47] transition-colors"
              onClick={() => navigate(`/event/${event.id}`)}
            >
              <td className="px-4 py-3 font-jetbrains text-xs">{event.id}</td>
              <td className="px-4 py-3">{event.eventName}</td>
              <td className="px-4 py-3">{event.productType}</td>
              <td className="px-4 py-3">{event.referenceEntity}</td>
              <td className="px-4 py-3">
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${STATUS_COLORS[event.status]}20`,
                    color: STATUS_COLORS[event.status],
                  }}
                >
                  {STATUS_LABELS[event.status as EventStatus]}
                </span>
              </td>
              <td className="px-4 py-3 font-jetbrains text-xs">
                {formatDate(event.createdAt)}
              </td>
              <td className="px-4 py-3">
                {event.needsManualSupplement && (
                  <AlertTriangle size={16} className="text-[#e8a838]" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
