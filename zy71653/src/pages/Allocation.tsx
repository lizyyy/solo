import { useState, useEffect, Fragment } from "react";
import {
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  GitCompare,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { AllocationSuggestion, Override } from "@/stores/appStore";

function ScenarioCompare({
  suggestions,
  overrides,
  onClose,
}: {
  suggestions: AllocationSuggestion[];
  overrides: Override[];
  onClose: () => void;
}) {
  const autoTotal = suggestions.reduce((s, x) => s + x.suggestedBudget, 0);
  const manualTotal = suggestions.reduce((s, x) => {
    const ov = overrides.find((o) => o.channelId === x.channelId);
    return s + (ov ? ov.budget : x.suggestedBudget);
  }, 0);
  const autoConv = suggestions.reduce(
    (s, x) => s + x.suggestedBudget * x.metrics.conversionRate,
    0
  );
  const manualConv = suggestions.reduce((s, x) => {
    const ov = overrides.find((o) => o.channelId === x.channelId);
    const budget = ov ? ov.budget : x.suggestedBudget;
    return s + budget * x.metrics.conversionRate;
  }, 0);
  const autoFatigue =
    suggestions.reduce((s, x) => s + x.metrics.fatigueScore, 0) /
    (suggestions.length || 1);
  const manualFatigue = autoFatigue;

  const Panel = ({
    title,
    total,
    conv,
    fatigue,
    color,
  }: {
    title: string;
    total: number;
    conv: number;
    fatigue: number;
    color: string;
  }) => (
    <div className="card p-5 flex-1">
      <h4 className={`text-sm font-semibold mb-3 ${color}`}>{title}</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">总预算</span>
          <span className="font-mono">¥{total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">预期转化</span>
          <span className="font-mono">{conv.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">平均疲劳度</span>
          <span className="font-mono">{fatigue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">情景对比</h3>
        <button onClick={onClose} className="btn-secondary text-xs py-1 px-3">
          关闭对比
        </button>
      </div>
      <div className="flex gap-6">
        <Panel
          title="方案 A：自动建议"
          total={autoTotal}
          conv={autoConv}
          fatigue={autoFatigue}
          color="text-primary-600"
        />
        <Panel
          title="方案 B：人工调整"
          total={manualTotal}
          conv={manualConv}
          fatigue={manualFatigue}
          color="text-accent-600"
        />
      </div>
      <div className="flex gap-6 text-sm text-zinc-500">
        <span>
          转化差值:{" "}
          <span className="font-mono">
            {(manualConv - autoConv).toFixed(1)}
          </span>
        </span>
        <span>
          预算差值:{" "}
          <span className="font-mono">
            ¥{(manualTotal - autoTotal).toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}

function SuggestionTable({
  suggestions,
  edits,
  onEdit,
  reasons,
  onReasonChange,
}: {
  suggestions: AllocationSuggestion[];
  edits: Record<string, number>;
  onEdit: (channelId: string, value: number) => void;
  reasons: Record<string, string>;
  onReasonChange: (channelId: string, reason: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confidenceBadge = (c: string) => {
    if (c === "high") return "badge-success";
    if (c === "medium") return "badge-warning";
    return "badge-critical";
  };
  const confidenceLabel = (c: string) => {
    if (c === "high") return "高";
    if (c === "medium") return "中";
    return "低";
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">渠道建议表</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left">
              <th className="px-5 py-3 font-medium text-zinc-500">渠道</th>
              <th className="px-5 py-3 font-medium text-zinc-500">当前预算</th>
              <th className="px-5 py-3 font-medium text-zinc-500">建议预算</th>
              <th className="px-5 py-3 font-medium text-zinc-500">变化幅度</th>
              <th className="px-5 py-3 font-medium text-zinc-500">转化率</th>
              <th className="px-5 py-3 font-medium text-zinc-500">疲劳度</th>
              <th className="px-5 py-3 font-medium text-zinc-500">剩余天数</th>
              <th className="px-5 py-3 font-medium text-zinc-500">信心度</th>
              <th className="px-5 py-3 font-medium text-zinc-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => {
              const isExpanded = expanded.has(s.channelId);
              const actualBudget = edits[s.channelId] ?? s.suggestedBudget;
              const isOverridden = actualBudget !== s.suggestedBudget;
              return (
                <Fragment key={s.channelId}>
                  <tr
                    className="border-b border-zinc-50 hover:bg-zinc-50"
                  >
                    <td className="px-5 py-3 font-medium">{s.channelName}</td>
                    <td className="px-5 py-3 font-mono">
                      ¥{s.currentBudget.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      ¥{s.suggestedBudget.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      <span
                        className={
                          s.changePercent > 0
                            ? "text-emerald-600"
                            : s.changePercent < 0
                            ? "text-red-600"
                            : ""
                        }
                      >
                        {s.changePercent > 0 ? "+" : ""}
                        {s.changePercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {s.metrics.conversionRate.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {s.metrics.fatigueScore.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {s.metrics.remainingDays}
                    </td>
                    <td className="px-5 py-3">
                      <span className={confidenceBadge(s.confidence)}>
                        {confidenceLabel(s.confidence)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggle(s.channelId)}
                        className="btn-secondary text-xs py-1 px-2 gap-1"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        {isExpanded ? "收起" : "展开"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${s.channelId}-detail`}>
                      <td colSpan={9} className="px-5 py-4 bg-zinc-50/50">
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <label className="text-sm text-zinc-600 shrink-0">
                              实际预算:
                            </label>
                            <input
                              type="number"
                              value={actualBudget}
                              onChange={(e) =>
                                onEdit(s.channelId, Number(e.target.value))
                              }
                              className="w-40 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          {isOverridden && (
                            <div className="flex items-center gap-4">
                              <label className="text-sm text-zinc-600 shrink-0">
                                覆盖原因:
                              </label>
                              <input
                                type="text"
                                value={reasons[s.channelId] ?? ""}
                                onChange={(e) =>
                                  onReasonChange(s.channelId, e.target.value)
                                }
                                placeholder="请输入覆盖原因"
                                className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          )}
                          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-800">
                            {s.explanation}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExplanationCards({
  suggestions,
}: {
  suggestions: AllocationSuggestion[];
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-zinc-900">人话解释</h3>
      <div className="grid grid-cols-2 gap-4">
        {suggestions.map((s) => (
          <div key={s.channelId} className="card p-4">
            <p className="text-sm text-zinc-700">{s.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistorySection() {
  const history = [
    {
      id: "1",
      version: "v3",
      date: "2026-05-29 18:30",
      total: 58000,
      changes: 3,
    },
    {
      id: "2",
      version: "v2",
      date: "2026-05-28 19:15",
      total: 55000,
      changes: 2,
    },
    {
      id: "3",
      version: "v1",
      date: "2026-05-27 17:45",
      total: 50000,
      changes: 5,
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">历史分配记录</h3>
      </div>
      <div className="card-body p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left">
              <th className="px-5 py-3 font-medium text-zinc-500">版本</th>
              <th className="px-5 py-3 font-medium text-zinc-500">时间</th>
              <th className="px-5 py-3 font-medium text-zinc-500">总预算</th>
              <th className="px-5 py-3 font-medium text-zinc-500">变更数</th>
              <th className="px-5 py-3 font-medium text-zinc-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-5 py-3 font-mono font-medium">{h.version}</td>
                <td className="px-5 py-3 font-mono">{h.date}</td>
                <td className="px-5 py-3 font-mono">
                  ¥{h.total.toLocaleString()}
                </td>
                <td className="px-5 py-3 font-mono">{h.changes}</td>
                <td className="px-5 py-3">
                  <button className="btn-secondary text-xs py-1 px-3 gap-1">
                    <RotateCcw className="w-3 h-3" />
                    回滚
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Allocation() {
  const {
    campaigns,
    allocations,
    loading,
    fetchCampaigns,
    generateAllocation,
    applyAllocation,
  } = useAppStore();

  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [totalBudget, setTotalBudget] = useState(0);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleGenerate = () => {
    if (!selectedCampaign || totalBudget <= 0) return;
    generateAllocation(selectedCampaign, totalBudget);
  };

  const handleEdit = (channelId: string, value: number) => {
    setEdits((prev) => ({ ...prev, [channelId]: value }));
  };

  const handleReasonChange = (channelId: string, reason: string) => {
    setReasons((prev) => ({ ...prev, [channelId]: reason }));
  };

  const handleApply = () => {
    const overrides: Override[] = Object.entries(edits)
      .filter(([channelId]) => {
        const suggestion = allocations.find((s) => s.channelId === channelId);
        return suggestion && edits[channelId] !== suggestion.suggestedBudget;
      })
      .map(([channelId, budget]) => ({
        channelId,
        budget,
        reason: reasons[channelId] ?? "",
      }));
    applyAllocation(selectedCampaign, allocations, overrides);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">预算分配</h2>

      <div className="card">
        <div className="card-body">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                选择投放活动
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">请选择活动</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                总预算 (¥)
              </label>
              <input
                type="number"
                value={totalBudget || ""}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                placeholder="输入总预算"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedCampaign || totalBudget <= 0}
              className="btn-primary gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? "生成中..." : "生成建议"}
            </button>
          </div>
        </div>
      </div>

      {allocations.length > 0 && (
        <>
          <SuggestionTable
            suggestions={allocations}
            edits={edits}
            onEdit={handleEdit}
            reasons={reasons}
            onReasonChange={handleReasonChange}
          />
          <ExplanationCards suggestions={allocations} />

          <div className="flex gap-3">
            <button
              onClick={() => setShowCompare(!showCompare)}
              className="btn-secondary gap-2"
            >
              <GitCompare className="w-4 h-4" />
              {showCompare ? "关闭对比" : "情景对比"}
            </button>
            <button onClick={handleApply} className="btn-primary gap-2">
              <Check className="w-4 h-4" />
              应用分配
            </button>
          </div>

          {showCompare && (
            <ScenarioCompare
              suggestions={allocations}
              overrides={Object.entries(edits).map(([channelId, budget]) => ({
                channelId,
                budget,
                reason: reasons[channelId] ?? "",
              }))}
              onClose={() => setShowCompare(false)}
            />
          )}
        </>
      )}

      <HistorySection />
    </div>
  );
}
