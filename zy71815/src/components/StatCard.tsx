import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  count?: number;
  icon: ReactNode;
  color: "teal" | "amber" | "emerald" | "slate";
}

const COLOR_MAP = {
  teal: "border-teal-700",
  amber: "border-amber-500",
  emerald: "border-emerald-600",
  slate: "border-slate-400",
};

const ICON_BG_MAP = {
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-500",
};

export default function StatCard({
  title,
  value,
  count,
  icon,
  color,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border-l-4 bg-white p-6 shadow-sm transition-shadow hover:shadow-md",
        COLOR_MAP[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-800">
            {value}
          </p>
          {count !== undefined && (
            <p className="mt-1 text-xs tabular-nums text-slate-400">
              {count} 笔
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            ICON_BG_MAP[color]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
