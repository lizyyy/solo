import { useState } from "react";
import {
  ChevronDown, ChevronRight, AlertTriangle, Check,
} from "lucide-react";
import type { Anomaly } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { anomalyLabel } from "@/utils/export";

const ANOMALY_STYLES: Record<
  Anomaly["type"],
  { bg: string; border: string; dot: string; text: string }
> = {
  answer_version_conflict: {
    bg: "bg-ochre-50",
    border: "border-ochre-300",
    dot: "bg-ochre-400",
    text: "text-ochre-600",
  },
  duplicate_submission: {
    bg: "bg-ink-50",
    border: "border-ink-200",
    dot: "bg-ink-400",
    text: "text-ink-600",
  },
  duplicate_sample: {
    bg: "bg-ochre-50/60",
    border: "border-ochre-200",
    dot: "bg-ochre-500",
    text: "text-ochre-700",
  },
  missing_note: {
    bg: "bg-fog-100",
    border: "border-fog-300",
    dot: "bg-fog-500",
    text: "text-ink-500",
  },
};

interface Props {
  anomaly: Anomaly;
}

export default function AnomalyCard({ anomaly }: Props) {
  const { setAnomalyResolved } = useAppStore();
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState(anomaly.resolverNote || "");
  const styles = ANOMALY_STYLES[anomaly.type];

  const toggleResolve = () => {
    setAnomalyResolved(anomaly.id, !anomaly.resolved, note);
  };

  return (
    <div
      className={`rounded-lg border ${styles.border} ${styles.bg} animate-pulse-border overflow-hidden`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-3 text-left flex items-start gap-3"
      >
        <div className={`w-2 h-2 rounded-full ${styles.dot} mt-2 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`chip ${styles.border} ${styles.text} bg-white/60`}>
              <AlertTriangle size={11} />
              {anomalyLabel(anomaly.type)}
            </span>
            {anomaly.resolved ? (
              <span className="chip bg-moss-100 text-moss-600 border border-moss-200">
                <Check size={11} />
                已处理
              </span>
            ) : (
              <span className="chip bg-ochre-100 text-ochre-600 border border-ochre-200">
                未处理
              </span>
            )}
            <span className="text-[10px] text-ink-400 font-mono ml-auto">
              涉及 {anomaly.relatedDraftIds.length} 条草稿
            </span>
          </div>
          <p className={`text-sm ${styles.text} mt-1 font-medium`}>
            {anomaly.sourceDescription}
          </p>
        </div>
        {open ? (
          <ChevronDown size={16} className="text-ink-400 shrink-0 mt-1" />
        ) : (
          <ChevronRight size={16} className="text-ink-400 shrink-0 mt-1" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/50 bg-white/30">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <p className="label mb-1">影响范围</p>
              <p className="text-sm text-ink-700">
                {anomaly.impactScope}
              </p>
            </div>
            <div>
              <p className="label mb-1">工具解释</p>
              <p className="text-sm text-ink-700">
                {anomaly.explanation}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <p className="label mb-1">人工处理备注</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full p-2 text-xs rounded border border-fog-300 bg-white focus:outline-none focus:border-ink-200"
              placeholder="请填写处理说明或确认意见…"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-ink-400">
              草稿 ID：
              <span className="font-mono">
                {anomaly.relatedDraftIds
                  .map((i) => i.slice(0, 6))
                  .join(" / ")}
              </span>
            </p>
            <button onClick={toggleResolve} className="btn-secondary !py-1 !text-xs">
              {anomaly.resolved ? "取消标记为未处理" : "标记已处理"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
