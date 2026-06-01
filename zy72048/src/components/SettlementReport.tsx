import { useGameStore } from "@/store/useGameStore";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Archive,
  Clock,
} from "lucide-react";

export default function SettlementReport() {
  const settlement = useGameStore((s) => s.settlement);
  const results = useGameStore((s) => s.results);

  if (!settlement) return null;

  const durationSec = (settlement.runDurationMs / 1000).toFixed(1);

  const smoothResults = results.filter((r) => r.status === "顺利");
  const confirmResults = results.filter((r) => r.status === "待人工确认");
  const oldCaliberResults = results.filter((r) => r.status === "旧口径补录");

  return (
    <div className="card-warm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-cliff flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" />
          结算报告
        </h2>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          {new Date(settlement.settledAt).toLocaleString("zh-CN")}
          {" · "}
          耗时 {durationSec}s
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-moss mb-1" />
          <div className="text-2xl font-display text-moss">
            {settlement.smoothCount}
          </div>
          <div className="text-xs text-gray-600">顺利通过</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <AlertCircle className="w-5 h-5 mx-auto text-rope mb-1" />
          <div className="text-2xl font-display text-rope">
            {settlement.confirmCount}
          </div>
          <div className="text-xs text-gray-600">待人工确认</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <Archive className="w-5 h-5 mx-auto text-purple-600 mb-1" />
          <div className="text-2xl font-display text-purple-700">
            {settlement.oldCaliberCount}
          </div>
          <div className="text-xs text-gray-600">旧口径补录</div>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        共校验 <strong className="text-rock-dark">{settlement.totalRecords}</strong> 条记录
      </div>

      {confirmResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-base text-rope flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            待人工确认清单
          </h3>
          {confirmResults.map((r) => (
            <div
              key={r.recordId}
              className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{r.recordId}</span>
                <span className="text-xs text-gray-400">回合 R{r.roundNumber}</span>
              </div>
              <p className="text-gray-700 mb-1">{r.reason}</p>
              <p className="text-rope">{r.suggestion}</p>
              <p className="text-xs text-gray-400 mt-1">
                来源：{r.source} · 处理时间：{new Date(r.processedAt).toLocaleString("zh-CN")}
              </p>
            </div>
          ))}
        </div>
      )}

      {oldCaliberResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-base text-purple-700 flex items-center gap-1">
            <Archive className="w-4 h-4" />
            旧口径补录清单
          </h3>
          {oldCaliberResults.map((r) => (
            <div
              key={r.recordId}
              className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{r.recordId}</span>
                <span className="text-xs text-gray-400">回合 R{r.roundNumber}</span>
              </div>
              <p className="text-gray-700 mb-1">{r.reason}</p>
              <p className="text-purple-700">{r.suggestion}</p>
              <p className="text-xs text-gray-400 mt-1">
                来源：{r.source} · 原始时间：{r.originalRecord.timestamp} · 处理时间：{new Date(r.processedAt).toLocaleString("zh-CN")}
              </p>
            </div>
          ))}
        </div>
      )}

      {smoothResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-base text-moss flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            顺利通过清单
          </h3>
          {smoothResults.map((r) => (
            <div
              key={r.recordId}
              className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{r.recordId}</span>
                <span className="text-xs text-gray-400">回合 R{r.roundNumber}</span>
              </div>
              <p className="text-gray-700 mb-1">{r.reason}</p>
              <p className="text-moss">{r.suggestion}</p>
              <p className="text-xs text-gray-400 mt-1">
                来源：{r.source} · 处理时间：{new Date(r.processedAt).toLocaleString("zh-CN")}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-warm pt-3 text-xs text-gray-400">
        本报告由"三角函数攀岩馆"校验工具生成 · 所有数字与明细一一对应 ·
        原始数据未做任何清洗
      </div>
    </div>
  );
}
