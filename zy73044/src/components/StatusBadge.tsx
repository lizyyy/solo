import type { RecordStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<RecordStatus, { label: string; cls: string; dot: string }> = {
  pending: {
    label: "待确认",
    cls: "bg-amber-50 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "已确认",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-400",
    dot: "bg-emerald-500",
  },
  withdrawn: {
    label: "已撤回",
    cls: "bg-slate-100 text-slate-700 border-slate-400",
    dot: "bg-slate-500",
  },
};

interface Props {
  status: RecordStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: Props) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-[2px] font-sans tracking-tight",
        s.cls,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
