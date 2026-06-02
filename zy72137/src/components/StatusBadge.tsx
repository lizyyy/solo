import type { SampleRecord } from "@/types";

const STATUS_CONFIG: Record<
  SampleRecord["authorizationStatus"],
  { label: string; color: string; bg: string }
> = {
  valid: { label: "有效", color: "text-emerald-400", bg: "bg-emerald-400/15 border-emerald-400/30" },
  expired: { label: "已过期", color: "text-red-400", bg: "bg-red-400/15 border-red-400/30" },
  missing: { label: "缺授权", color: "text-amber-400", bg: "bg-amber-400/15 border-amber-400/30" },
  unknown: { label: "未确认", color: "text-zinc-400", bg: "bg-zinc-400/15 border-zinc-400/30" },
};

export default function StatusBadge({ status }: { status: SampleRecord["authorizationStatus"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

export function IssueBadge({ type }: { type: "expired" | "timecode" | "duplicate" | "oldMaster" | "rename" }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    expired: { label: "过期", color: "text-red-400", bg: "bg-red-400/15 border-red-400/30" },
    timecode: { label: "时码错位", color: "text-sky-400", bg: "bg-sky-400/15 border-sky-400/30" },
    duplicate: { label: "重复", color: "text-violet-400", bg: "bg-violet-400/15 border-violet-400/30" },
    oldMaster: { label: "旧母带", color: "text-zinc-400", bg: "bg-zinc-500/15 border-zinc-500/30" },
    rename: { label: "改名", color: "text-teal-400", bg: "bg-teal-400/15 border-teal-400/30" },
  };
  const c = cfg[type];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${c.bg} ${c.color}`}
    >
      {c.label}
    </span>
  );
}
