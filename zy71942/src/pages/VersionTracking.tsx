import { useState } from "react";
import { Link } from "react-router-dom";
import {
  GitCompare,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Pencil,
  AlertTriangle,
  Layers,
  Radio,
  FileText,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { PayloadPlan, TimeWindow } from "@/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WindowRow({ window: w, variant }: { window: TimeWindow; variant: "added" | "removed" | "modified" }) {
  const bgClass =
    variant === "added"
      ? "bg-emerald-900/30 border-emerald-700/40"
      : variant === "removed"
        ? "bg-red-900/30 border-red-700/40"
        : "bg-amber-900/30 border-amber-700/40";

  const icon =
    variant === "added" ? (
      <Plus className="w-3.5 h-3.5 text-emerald-400" />
    ) : variant === "removed" ? (
      <Minus className="w-3.5 h-3.5 text-red-400" />
    ) : (
      <Pencil className="w-3.5 h-3.5 text-amber-400" />
    );

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded border ${bgClass}`}>
      {icon}
      <span className="text-sm text-slate-200 font-mono">{w.stationName}</span>
      <span className="text-sm text-slate-400 font-mono">
        {w.startTime} ~ {w.endTime}
      </span>
      <span className="text-xs text-slate-500 ml-auto">{w.timeSystem}</span>
    </div>
  );
}

function DiffCard({ diff }: { diff: import("@/types").VersionDiff }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => hasChanges && setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/60 hover:bg-slate-800 transition-colors"
      >
        {hasChanges ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-amber-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-400" />
          )
        ) : (
          <span className="w-4" />
        )}
        <span className="text-sm font-mono text-slate-300">{diff.oldVersion}</span>
        <span className="text-amber-400 text-sm">→</span>
        <span className="text-sm font-mono text-slate-100">{diff.newVersion}</span>
        <span className="text-xs text-slate-500 ml-3">{diff.summary}</span>
      </button>

      {expanded && hasChanges && (
        <div className="px-4 py-3 space-y-2 bg-slate-900/50">
          {diff.added.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium uppercase tracking-wider">
                <Plus className="w-3 h-3" />
                新增窗口
              </div>
              {diff.added.map((w) => (
                <WindowRow key={w.id} window={w} variant="added" />
              ))}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium uppercase tracking-wider">
                <Minus className="w-3 h-3" />
                删除窗口
              </div>
              {diff.removed.map((w) => (
                <WindowRow key={w.id} window={w} variant="removed" />
              ))}
            </div>
          )}
          {diff.modified.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium uppercase tracking-wider">
                <Pencil className="w-3 h-3" />
                修改窗口
              </div>
              {diff.modified.map((w) => (
                <WindowRow key={w.id} window={w} variant="modified" />
              ))}
            </div>
          )}
        </div>
      )}

      {diff.affectedConflictIds.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-700/60 bg-slate-800/30">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">受影响的冲突</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {diff.affectedConflictIds.map((cid) => (
              <Link
                key={cid}
                to="/conflicts"
                className="text-xs font-mono text-slate-400 hover:text-amber-400 hover:underline transition-colors"
              >
                {cid.slice(0, 8)}…
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanInfoCard({ plan }: { plan: PayloadPlan }) {
  return (
    <div className="border border-slate-700 rounded-lg p-5 bg-slate-800/40 space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">{plan.name}</h3>
        <span className="px-2 py-0.5 text-xs font-mono bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
          v{plan.version}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-4 h-4" />
          <span>导入时间</span>
          <span className="text-slate-200 font-mono ml-auto">{formatDate(plan.importedAt)}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <User className="w-4 h-4" />
          <span>操作人</span>
          <span className="text-slate-200 ml-auto">{plan.operator}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Layers className="w-4 h-4" />
          <span>窗口数量</span>
          <span className="text-slate-200 ml-auto">{plan.windows.length}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Radio className="w-4 h-4" />
          <span>遥测段数量</span>
          <span className="text-slate-200 ml-auto">{plan.telemetrySegments.length}</span>
        </div>
      </div>
    </div>
  );
}

export default function VersionTracking() {
  const plans = useStore((s) => s.plans);
  const versionDiffs = useStore((s) => s.versionDiffs);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const planDiffs = versionDiffs.filter((d) => d.planId === selectedPlanId);

  return (
    <div className="space-y-8">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GitCompare className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold">版本追踪</h1>
          </div>
          <p className="text-sm text-slate-400">追踪载荷计划的版本变更，对比不同版本间的窗口增删改情况</p>
        </div>

        <div className="flex gap-6">
          <div className="w-1/3 shrink-0">
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-700">
                <h2 className="text-sm font-semibold text-slate-200">载荷计划版本</h2>
              </div>
              <div className="divide-y divide-slate-700/60">
                {plans.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">暂无载荷计划</div>
                )}
                {plans.map((plan) => {
                  const hasDiffs = versionDiffs.some((d) => d.planId === plan.id);
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isSelected
                          ? "bg-amber-500/10 border-l-2 border-amber-400"
                          : "hover:bg-slate-800/50 border-l-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {plan.name}
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-300 rounded">
                          v{plan.version}
                        </span>
                        {hasDiffs && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                            有变更
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{formatDate(plan.importedAt)}</span>
                        <span>{plan.operator}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-2/3">
            {!selectedPlan ? (
              <div className="flex items-center justify-center h-64 border border-dashed border-slate-700 rounded-lg">
                <p className="text-sm text-slate-500">请从左侧选择载荷计划查看版本详情</p>
              </div>
            ) : (
              <div className="space-y-6">
                <PlanInfoCard plan={selectedPlan} />

                <div>
                  <h2 className="text-sm font-semibold text-slate-200 mb-3">版本变更记录</h2>
                  {planDiffs.length === 0 ? (
                    <div className="flex items-center justify-center h-24 border border-dashed border-slate-700 rounded-lg">
                      <p className="text-sm text-slate-500">该计划暂无版本变更记录</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {planDiffs.map((diff) => (
                        <DiffCard key={diff.id} diff={diff} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
