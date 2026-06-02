import { PointStatus, STATUS_LABELS } from "@/types";
import { clsx } from "clsx";

const STATUS_COLORS: Record<PointStatus, string> = {
  processed: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  field_review: "bg-orange-100 text-orange-800",
};

const STATUS_DOT_COLORS: Record<PointStatus, string> = {
  processed: "bg-emerald-500",
  pending: "bg-amber-500",
  field_review: "bg-orange-500",
};

export function StatusBadge({ status }: { status: PointStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_COLORS[status]
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", STATUS_DOT_COLORS[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: PointStatus }) {
  return (
    <span className={clsx("w-2.5 h-2.5 rounded-full", STATUS_DOT_COLORS[status])} />
  );
}
