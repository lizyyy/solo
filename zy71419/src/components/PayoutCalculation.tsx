import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Calculator, AlertTriangle } from "lucide-react";
import { useStore } from "@/store/useStore";

interface PayoutCalculationProps {
  eventId: string;
}

export default function PayoutCalculation({ eventId }: PayoutCalculationProps) {
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const allPayouts = useStore((s) => s.payouts);
  const payout = useMemo(() => allPayouts.find((p) => p.eventId === eventId), [allPayouts, eventId]);

  if (!payout) {
    return (
      <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#e8a838]" />
          <span className="text-[#f0ece4] font-medium text-sm">赔付试算</span>
        </div>
        <p className="text-[#6b7894] text-xs mt-2">暂无赔付试算记录</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#e8a838]" />
          <span className="text-[#f0ece4] font-medium text-sm">赔付试算</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            payout.isComplete
              ? "bg-[#2dd4a8]/20 text-[#2dd4a8]"
              : "bg-[#e8a838]/20 text-[#e8a838]"
          }`}
        >
          {payout.isComplete ? "已完成" : "未完成"}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {payout.payoutPrice === null && (
          <div className="flex items-center gap-2 bg-[#e8a838]/10 border border-[#e8a838]/30 rounded px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-[#e8a838] shrink-0" />
            <span className="text-[#e8a838] text-xs">赔付价格缺失</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0f1225] border border-[#2a3050] rounded p-2">
            <p className="text-[#6b7894] text-xs mb-1">名义金额</p>
            <p className="text-[#f0ece4] text-sm font-mono">
              {payout.notionalAmount.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#0f1225] border border-[#2a3050] rounded p-2">
            <p className="text-[#6b7894] text-xs mb-1">回收率</p>
            <p className="text-[#f0ece4] text-sm font-mono">
              {(payout.recoveryRate * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-[#0f1225] border border-[#2a3050] rounded p-2">
            <p className="text-[#6b7894] text-xs mb-1">赔付价格</p>
            <p className="text-sm font-mono">
              {payout.payoutPrice !== null ? (
                <span className="text-[#f0ece4]">
                  {payout.payoutPrice.toLocaleString()}
                </span>
              ) : (
                <span className="text-[#ef4444]">--</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#2a3050] text-[#6b7894] text-xs px-1.5 py-0.5 rounded font-mono">
            公告: {payout.announcementVersionId}
          </span>
          <span className="bg-[#2a3050] text-[#6b7894] text-xs px-1.5 py-0.5 rounded font-mono">
            投票: {payout.voteResultId}
          </span>
        </div>

        <div>
          <button
            onClick={() => setStepsExpanded(!stepsExpanded)}
            className="flex items-center gap-1 text-[#6b7894] text-xs hover:text-[#f0ece4] transition-colors"
          >
            {stepsExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            计算步骤
          </button>

          {stepsExpanded && (
            <div className="mt-2 space-y-1.5">
              {payout.calculationSteps.map((step) => (
                <div
                  key={step.step}
                  className="bg-[#0f1225] border border-[#2a3050] rounded px-3 py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#6b7894] text-xs font-mono w-5 shrink-0">
                      {step.step}.
                    </span>
                    <div>
                      <p className="text-[#f0ece4] text-xs">{step.description}</p>
                      <p className="text-[#6b7894] text-xs font-mono">
                        {step.formula}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono shrink-0 ${
                      step.result !== null ? "text-[#f0ece4]" : "text-[#ef4444]"
                    }`}
                  >
                    {step.result !== null
                      ? step.result.toLocaleString()
                      : "缺失"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[#6b7894] text-xs font-mono">
          计算时间: {new Date(payout.calculatedAt).toLocaleString("zh-CN")}
        </p>
      </div>
    </div>
  );
}
