interface StatusBadgeProps {
  status: "conflict" | "pending" | "resolved" | "none" | "pending_verification";
}

const config: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  conflict: { label: "冲突", dot: "bg-conflict", bg: "bg-red-50", text: "text-conflict" },
  pending: { label: "待处理", dot: "bg-pending", bg: "bg-amber-50", text: "text-pending" },
  pending_verification: { label: "待核实", dot: "bg-pending", bg: "bg-amber-50", text: "text-pending" },
  resolved: { label: "已决", dot: "bg-resolved", bg: "bg-green-50", text: "text-resolved" },
  none: { label: "正常", dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-600" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const c = config[status] || config.none;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
