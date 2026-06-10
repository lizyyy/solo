import type { ChecklistStatus } from "shared/types";
import { getStatusMeta } from "@/utils/format";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ChecklistStatus;
  className?: string;
}

const statusColorMap: Record<ChecklistStatus, string> = {
  confirmed: "bg-accent-confirmed text-white border-accent-confirmed",
  pending: "bg-accent-pending text-white border-accent-pending",
  returned: "bg-accent-returned text-white border-accent-returned",
  suspended: "bg-accent-suspended text-white border-accent-suspended",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label } = getStatusMeta(status);
  return (
    <span className={cn("chip border", statusColorMap[status], className)}>
      {label}
    </span>
  );
}
