import { useGameStore } from "@/store/useGameStore";
import { AlertTriangle, Mountain, Copy } from "lucide-react";

export default function ConfigPanel() {
  const configs = useGameStore((s) => s.configs);
  const configErrors = useGameStore((s) => s.configErrors);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl text-cliff flex items-center gap-2">
        <Mountain className="w-5 h-5" />
        关卡配置
      </h2>

      {configErrors.length > 0 && (
        <div className="bg-amber-50 border border-amber-warn rounded-lg p-3 space-y-1">
          {configErrors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {configs.map((cfg) => {
          const boundsInvalid = cfg.resourceBounds.min > cfg.resourceBounds.max;
          const hasDup = cfg.events.some(
            (e, i) => cfg.events.findIndex((x) => x.id === e.id) !== i
          );
          const isEmpty = cfg.events.length === 0;
          const hasIssue = boundsInvalid || hasDup || isEmpty;

          return (
            <div
              key={cfg.id}
              className={`p-4 rounded-xl ${
                hasIssue
                  ? isEmpty
                    ? "card-empty"
                    : "card-warm card-warn"
                  : "card-warm"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-base text-rock-dark">
                  {cfg.name}
                </span>
                <div className="flex gap-1">
                  {isEmpty && (
                    <span className="status-badge bg-gray-100 text-gray-500">
                      空关卡
                    </span>
                  )}
                  {hasDup && (
                    <span className="status-badge bg-orange-100 text-rope">
                      重复事件
                    </span>
                  )}
                  {boundsInvalid && (
                    <span className="status-badge bg-red-100 text-danger">
                      边界异常
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex items-center gap-4">
                  <span>
                    及格线：<strong>{cfg.requiredScore}分</strong>
                  </span>
                  <span className={boundsInvalid ? "text-danger font-semibold" : ""}>
                    资源范围：[{cfg.resourceBounds.min}, {cfg.resourceBounds.max}]
                    {boundsInvalid && " ← 最小值大于最大值！"}
                  </span>
                </div>
              </div>

              {cfg.events.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {cfg.events.map((evt, i) => (
                    <div
                      key={`${evt.id}-${i}`}
                      className="flex items-center gap-2 text-xs bg-white/50 rounded-lg px-3 py-1.5"
                    >
                      {hasDup &&
                        cfg.events.findIndex((x) => x.id === evt.id) !== i && (
                          <Copy className="w-3 h-3 text-rope" />
                        )}
                      <span className="font-medium text-cliff">{evt.type}</span>
                      <span className="text-gray-500">
                        {evt.trigger} → {evt.action}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-400 italic">
                  此关卡暂无事件配置
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
