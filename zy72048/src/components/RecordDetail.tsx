import { useGameStore } from "@/store/useGameStore";
import { CheckCircle2, AlertCircle, Archive, FileText } from "lucide-react";
import type { RecordStatus } from "@/types";

const STATUS_ICON: Record<RecordStatus, typeof CheckCircle2> = {
  "顺利": CheckCircle2,
  "待人工确认": AlertCircle,
  "旧口径补录": Archive,
};

const STATUS_STYLE: Record<RecordStatus, string> = {
  "顺利": "bg-emerald-100 text-emerald-700",
  "待人工确认": "bg-orange-100 text-rope",
  "旧口径补录": "bg-purple-100 text-purple-700",
};

export default function RecordDetail() {
  const results = useGameStore((s) => s.results);
  const status = useGameStore((s) => s.status);

  if (results.length === 0 && status === "idle") {
    return (
      <div className="card-warm p-6 text-center text-gray-400">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>点击「开始校验」查看逐条判断过程</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl text-cliff flex items-center gap-2">
        <FileText className="w-5 h-5" />
        记录明细
        <span className="text-sm font-normal text-gray-500">
          （{results.length} 条已判断）
        </span>
      </h2>

      {results.map((result, idx) => {
        const Icon = STATUS_ICON[result.status];
        const badgeStyle = STATUS_STYLE[result.status];
        return (
          <div
            key={result.recordId}
            className="card-warm p-4 animate-slide-in"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">
                  R{result.roundNumber}
                </span>
                <span className="font-display text-base">
                  {result.originalRecord.id}
                </span>
                <span className={`status-badge ${badgeStyle}`}>
                  <Icon className="w-3 h-3" />
                  {result.status}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(result.processedAt).toLocaleTimeString("zh-CN")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
              <div>
                <span className="text-gray-500">来源：</span>
                <span className="font-medium">{result.source}</span>
              </div>
              <div>
                <span className="text-gray-500">关卡：</span>
                <span className="font-medium">
                  {result.originalRecord.levelId}
                </span>
              </div>
              <div>
                <span className="text-gray-500">分数：</span>
                <span className="font-medium">
                  {result.originalRecord.score ?? "缺失"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">资源值：</span>
                <span className="font-medium">
                  {result.originalRecord.resourceValue ?? "缺失"}
                </span>
              </div>
            </div>

            <div className="mb-3">
              <span className="text-gray-500 text-sm">原始备注：</span>
              <div className="bg-white/60 rounded-lg px-3 py-2 text-sm mt-1 border border-warm font-mono break-all">
                {result.originalRecord.rawNote}
              </div>
            </div>

            <div className="mb-3">
              <span className="text-gray-500 text-sm">判断过程：</span>
              <div className="space-y-1 mt-1">
                {result.checkSteps.map((step, si) => (
                  <div
                    key={si}
                    className="flex items-start gap-2 text-xs"
                  >
                    {step.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-moss mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rope mt-0.5 shrink-0" />
                    )}
                    <span>
                      <strong>{step.label}：</strong>
                      {step.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-warm pt-2">
              <span className="text-gray-500 text-sm">处理建议：</span>
              <p className="text-sm mt-1 leading-relaxed">{result.suggestion}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
