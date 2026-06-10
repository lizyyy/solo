import type { ChecklistStatus, Role } from "shared/types";
import { STATUS_LABEL, ROLE_LABEL } from "shared/types";

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function getStatusMeta(status: ChecklistStatus): { label: string; colorClass: string } {
  const label = STATUS_LABEL[status];
  const colorMap: Record<ChecklistStatus, string> = {
    confirmed: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    returned: "bg-red-100 text-red-700 border-red-200",
    suspended: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return { label, colorClass: colorMap[status] };
}

export function getRoleLabel(role: Role): string {
  return ROLE_LABEL[role];
}
