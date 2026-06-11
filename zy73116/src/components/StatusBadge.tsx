import type { CollisionStatus } from "@/types";

interface Props {
  status: CollisionStatus;
  isDuplicate?: boolean;
}

const styles: Record<CollisionStatus, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
};

const labels: Record<CollisionStatus, string> = {
  confirmed: "已确认",
  pending: "待补件",
  rejected: "退回",
};

export default function StatusBadge({ status, isDuplicate }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium tracking-wide ${styles[status]}`}
    >
      {isDuplicate && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      {labels[status]}
    </span>
  );
}
