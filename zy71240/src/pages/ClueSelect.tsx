import { useState, useEffect, useCallback } from "react";
import { useGameStore, getAvailableClues } from "@/store/gameStore";
import { useParams, useNavigate } from "react-router-dom";
import { CASES } from "@/data/mockData";
import type { ClueItem } from "@/types";
import {
  Clock,
  Search,
  FileText,
  DollarSign,
  User,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

const TAB_CONFIG = [
  { key: "部位卡" as const, label: "部位卡", icon: Search },
  { key: "维修价目" as const, label: "维修价目", icon: DollarSign },
  { key: "保单条款" as const, label: "保单条款", icon: FileText },
  { key: "客户情绪" as const, label: "客户情绪", icon: User },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function PartCardContent({ clue }: { clue: ClueItem }) {
  const data = clue.data as import("@/types").PartCard;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-steel-500">{data.partName}</h4>
        {data.hasOldDamage && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber/10 text-amber-dark">
            <AlertTriangle className="w-3 h-3" />
            疑似旧伤
          </span>
        )}
      </div>
      <p className="text-sm text-cool">{data.damageDescription}</p>
      {data.hasOldDamage && (
        <p className="text-xs text-amber-dark bg-amber/5 rounded px-2 py-1">
          {data.oldDamageDetail}
        </p>
      )}
    </div>
  );
}

function RepairPriceContent({ clue }: { clue: ClueItem }) {
  const data = clue.data as import("@/types").RepairPrice;
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-steel-500">{data.partName}</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-cool text-xs">
            <th className="text-left font-medium pb-1">轻微</th>
            <th className="text-left font-medium pb-1">中度</th>
            <th className="text-left font-medium pb-1">重度</th>
            {data.totalLossPrice > 0 && (
              <th className="text-left font-medium pb-1">报废</th>
            )}
          </tr>
        </thead>
        <tbody>
          <tr className="text-steel-500 font-medium">
            <td className="pb-1">¥{data.minorPrice.toLocaleString()}</td>
            <td className="pb-1">¥{data.moderatePrice.toLocaleString()}</td>
            <td className="pb-1">¥{data.severePrice.toLocaleString()}</td>
            {data.totalLossPrice > 0 && (
              <td className="pb-1">¥{data.totalLossPrice.toLocaleString()}</td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PolicyRuleContent({ clue }: { clue: ClueItem }) {
  const data = clue.data as import("@/types").PolicyRule;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-steel-500">{data.clauseType}</h4>
        {data.isExemption && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            免责条款
          </span>
        )}
      </div>
      <p className="text-sm text-cool">{data.clauseContent}</p>
      {data.coverageLimit > 0 && (
        <p className="text-xs text-steel-400">
          限额：¥{data.coverageLimit.toLocaleString()}
        </p>
      )}
    </div>
  );
}

function CustomerMoodContent({ clue }: { clue: ClueItem }) {
  const data = clue.data as import("@/types").CustomerMood;
  const scoreColor =
    data.credibilityScore >= 80
      ? "bg-jade"
      : data.credibilityScore >= 50
        ? "bg-amber"
        : "bg-red-500";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-steel-500">
          情绪类型：{data.moodType}
        </h4>
      </div>
      <p className="text-sm text-cool">{data.behaviorDescription}</p>
      <div>
        <div className="flex items-center justify-between text-xs text-cool mb-1">
          <span>可信度</span>
          <span>{data.credibilityScore}%</span>
        </div>
        <div className="w-full h-2 bg-steel-50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${scoreColor}`}
            style={{ width: `${data.credibilityScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ClueCardRenderer({ clue }: { clue: ClueItem }) {
  switch (clue.type) {
    case "部位卡":
      return <PartCardContent clue={clue} />;
    case "维修价目":
      return <RepairPriceContent clue={clue} />;
    case "保单条款":
      return <PolicyRuleContent clue={clue} />;
    case "客户情绪":
      return <CustomerMoodContent clue={clue} />;
    default:
      return <p className="text-sm text-cool">{clue.description}</p>;
  }
}

export default function ClueSelect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<import("@/types").ClueType>("部位卡");

  const selectedClues = useGameStore((s) => s.selectedClues);
  const selectClue = useGameStore((s) => s.selectClue);
  const deselectClue = useGameStore((s) => s.deselectClue);
  const maxClueSelections = useGameStore((s) => s.maxClueSelections);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const tick = useGameStore((s) => s.tick);
  const submitJudgments = useGameStore((s) => s.submitJudgments);

  const caseData = CASES.find((c) => c.id === id);
  const allClues = id ? getAvailableClues(id) : [];

  const filteredClues = allClues.filter((c) => c.type === activeTab);

  const isSelected = useCallback(
    (clueId: string) => selectedClues.some((c) => c.id === clueId),
    [selectedClues]
  );

  const isMaxReached = selectedClues.length >= maxClueSelections;

  const handleToggle = (clue: ClueItem) => {
    if (isSelected(clue.id)) {
      deselectClue(clue.id);
    } else if (!isMaxReached) {
      selectClue(clue);
    }
  };

  const handleConfirm = () => {
    if (selectedClues.length === 0) return;
    submitJudgments();
    navigate(`/case/${id}/judge`);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      submitJudgments();
      navigate(`/case/${id}/judge`);
    }
  }, [timeRemaining, submitJudgments, navigate, id]);

  const timerPercent = (timeRemaining / 180) * 100;
  const timerBarColor =
    timeRemaining > 60
      ? "bg-jade"
      : timeRemaining > 30
        ? "bg-amber"
        : "bg-red-500";

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-steel-500 h-1.5 relative">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${timerBarColor}`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-steel-500">
            <Clock className="w-5 h-5" />
            <span className="font-mono text-lg font-bold">
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <span className="text-cool">已选</span>
            <span
              className={`font-bold text-lg ${
                isMaxReached ? "text-amber" : "text-steel-500"
              }`}
            >
              {selectedClues.length}
            </span>
            <span className="text-cool">/{maxClueSelections}</span>
          </div>
        </div>

        {caseData && (
          <div className="mb-4 text-sm text-cool">
            案件：{caseData.caseNumber} · {caseData.carModel}
          </div>
        )}

        <div className="flex gap-1 mb-4 border-b border-steel-50">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => {
            const count = allClues.filter((c) => c.type === key).length;
            const selectedCount = selectedClues.filter(
              (c) => c.type === key
            ).length;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? "border-amber text-amber"
                    : "border-transparent text-cool hover:text-steel-500"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      selectedCount > 0
                        ? "bg-amber/10 text-amber-dark"
                        : "bg-steel-50 text-cool"
                    }`}
                  >
                    {selectedCount > 0 ? `${selectedCount}/${count}` : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {filteredClues.map((clue) => {
            const selected = isSelected(clue.id);
            const disabled = !selected && isMaxReached;
            return (
              <div
                key={clue.id}
                onClick={() => !disabled && handleToggle(clue)}
                className={`clue-card ${selected ? "clue-card-selected" : ""} ${disabled ? "clue-card-disabled" : ""}`}
              >
                <div className="card-body">
                  <ClueCardRenderer clue={clue} />
                </div>
              </div>
            );
          })}
        </div>

        {filteredClues.length === 0 && (
          <div className="text-center py-12 text-cool">该类别暂无线索</div>
        )}

        <div className="sticky bottom-0 bg-cream/90 backdrop-blur-sm py-4 border-t border-steel-50">
          <button
            onClick={handleConfirm}
            disabled={selectedClues.length === 0}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-md font-semibold text-lg transition-colors ${
              selectedClues.length > 0
                ? "btn-amber"
                : "bg-steel-100 text-cool cursor-not-allowed"
            }`}
          >
            确认选择，进入判定
            <ChevronRight className="w-5 h-5" />
          </button>
          {selectedClues.length === 0 && (
            <p className="text-center text-xs text-cool mt-2">
              请至少选择 1 条线索
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
