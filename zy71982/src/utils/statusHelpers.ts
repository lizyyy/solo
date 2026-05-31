import type { EventStatus, ExceptionType } from "@/types";
import {
  STATUS_LABELS,
  EXCEPTION_LABELS,
  PENDING_CONFIRM_STATUSES,
} from "@/types";

type StatusStyle = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export function getStatusStyle(status: EventStatus): StatusStyle {
  const styles: Record<EventStatus, StatusStyle> = {
    pending: {
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-700 dark:text-zinc-300",
      border: "border-zinc-300 dark:border-zinc-600",
      dot: "bg-zinc-400",
    },
    processing: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-300 dark:border-amber-700",
      dot: "bg-amber-500 animate-pulse",
    },
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-300 dark:border-emerald-700",
      dot: "bg-emerald-500",
    },
    failed: {
      bg: "bg-red-50 dark:bg-red-950/40",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-300 dark:border-red-700",
      dot: "bg-red-500",
    },
    pending_confirm_idempotency: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-400 dark:border-amber-600 border-dashed",
      dot: "bg-amber-500",
    },
    pending_confirm_audit_gap: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-400 dark:border-amber-600 border-dashed",
      dot: "bg-amber-500",
    },
    pending_confirm_param_corrupted: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-400 dark:border-amber-600 border-dashed",
      dot: "bg-amber-500",
    },
    revoked: {
      bg: "bg-slate-50 dark:bg-slate-900/40",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-300 dark:border-slate-600",
      dot: "bg-slate-400",
    },
  };
  return styles[status];
}

export function getStatusLabel(status: EventStatus): string {
  return STATUS_LABELS[status];
}

export function getExceptionLabel(type: ExceptionType): string {
  return EXCEPTION_LABELS[type];
}

export function isPendingConfirm(status: EventStatus): boolean {
  return PENDING_CONFIRM_STATUSES.includes(status);
}

export function isTerminal(status: EventStatus): boolean {
  return ["success", "failed"].includes(status);
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return formatTimestamp(ts);
}

export function getRowHighlight(status: EventStatus): string {
  if (isPendingConfirm(status)) {
    return "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30";
  }
  if (status === "failed") {
    return "bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20";
  }
  return "hover:bg-zinc-50 dark:hover:bg-zinc-800/50";
}
