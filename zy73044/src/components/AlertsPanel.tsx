import { useState } from "react";
import { AlertTriangle, AlertCircle, Zap, ChevronRight } from "lucide-react";
import type { SpareRecord, AnomalyType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  records: SpareRecord[];
  onViewRaw: (r: SpareRecord) => void;
  onLocate: (r: SpareRecord) => void;
}

const TAB: { key: AnomalyType; title: string; icon: typeof AlertTriangle; accent: string; countOf: (r: SpareRecord) => boolean }[] = [
  {
    key: "gap",
    title: "采样断档",
    icon: Zap,
    accent: "text-[#EA580C] border-[#EA580C] bg-orange-50",
    countOf: (r) => r.anomalies.includes("gap"),
  },
  {
    key: "missing",
    title: "字段缺失",
    icon: AlertCircle,
    accent: "text-red-700 border-red-400 bg-red-50",
    countOf: (r) => r.anomalies.includes("missing"),
  },
  {
    key: "conflict",
    title: "状态冲突",
    icon: AlertTriangle,
    accent: "text-purple-700 border-purple-400 bg-purple-50",
    countOf: (r) => r.anomalies.includes("conflict"),
  },
];

export default function AlertsPanel({ records, onViewRaw, onLocate }: Props) {
  const [active, setActive] = useState<AnomalyType>("gap");
  const activeTab = TAB.find((t) => t.key === active)!;
  const list = records.filter(activeTab.countOf);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-[2px] bg-[#EA580C] flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-sans font-black text-slate-800 tracking-tight text-lg">
          异常区 <span className="text-[#EA580C]">— 先处理这些</span>
        </h2>
        <span className="ml-2 text-[10px] font-sans text-slate-400 tracking-widest uppercase">
          Alerts
        </span>
      </div>

      <div className="border-2 border-slate-800 rounded-[2px] bg-white overflow-hidden">
        <div className="flex border-b-2 border-slate-800 bg-slate-50">
          {TAB.map((t) => {
            const count = records.filter(t.countOf).length;
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 font-sans text-sm tracking-tight transition-colors",
                  isActive
                    ? "bg-white border-r border-l border-slate-800 -mb-[2px] text-slate-900 font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}
                style={{ borderLeftWidth: 0 }}
              >
                <Icon className="w-4 h-4" />
                <span>{t.title}</span>
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-sans font-black tabular-nums",
                    count > 0 ? "bg-slate-900 text-white" : "bg-slate-300 text-slate-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[340px] overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-10 text-center">
              <div className="font-sans text-slate-400 text-sm tracking-tight">
                — {activeTab.title}类异常，全部清零 —
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {list.map((r) => (
                <li
                  key={r.id}
                  className="px-4 py-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded-[2px]">
                          {r.partNo}
                        </code>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-sans rounded-[2px] border",
                            activeTab.accent
                          )}
                        >
                          <activeTab.icon className="w-3 h-3" />
                          {activeTab.title}
                        </span>
                      </div>
                      <div className="mt-1.5 font-serif text-sm text-slate-800 line-clamp-1">
                        {r.partDesc || <span className="text-red-500 italic">（备件描述缺失）</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-slate-500">
                        <span>
                          采样：
                          <b className={cn("tabular-nums", r.sampling ? "text-slate-800" : "text-red-500")}>
                            {r.sampling ?? "空"}
                          </b>
                        </span>
                        {r.gapDetail && (
                          <span className="text-[#EA580C]">
                            上次：<b className="tabular-nums">{r.gapDetail.prevValue ?? "空"}</b>
                          </span>
                        )}
                        <span className="truncate max-w-[260px]">来源：{r.sourceFile}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewRaw(r)}
                        className="h-8 px-2.5 rounded-[2px] border-2 border-slate-700 text-slate-800 bg-white hover:bg-slate-100 font-sans text-xs tracking-tight flex items-center gap-1"
                      >
                        原始说法
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onLocate(r)}
                        className="h-8 px-2.5 rounded-[2px] border-2 border-[#1E40AF] text-[#1E40AF] bg-white hover:bg-blue-50 font-sans text-xs tracking-tight"
                      >
                        找它
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
