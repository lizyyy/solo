import { ArrowRight, Download, MapPin, X, Zap } from "lucide-react";
import { usePlaybackStore } from "@/store/usePlaybackStore";

export function QuickStartCard() {
  const { quickStartVisible, toggleQuickStart, jumpToNext, anomalies } = usePlaybackStore();
  if (!quickStartVisible) return null;

  const pending = anomalies.find((a) => a.type === "pending_confirmation");

  const steps = [
    {
      icon: <MapPin className="h-4 w-4 text-tide-400" />,
      title: "样例在哪",
      body: "本页已默认载入「小包测试数据」，包含浮标日志、晚到船上记录、补充说明。",
    },
    {
      icon: <Zap className="h-4 w-4 text-alert-amber" />,
      title: "异常在哪",
      body: "时间轴上红色=异常、琥珀=待确认（潮位单位混写），点击可跳到对应点。",
      action: pending
        ? { label: "跳到待确认点", onClick: () => jumpToNext("pending") }
        : undefined,
    },
    {
      icon: <Download className="h-4 w-4 text-ocean-500" />,
      title: "结果怎么导出",
      body: "右上角「导出结果」按钮，会把当前版本数据与口径快照打包为 JSON。",
    },
  ];

  return (
    <div className="glass-card animate-floatSlow relative overflow-hidden p-4">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-tide-500/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-white">
            阿乔接班 · 3 步上手
          </h3>
          <button
            className="rounded-full p-1 text-ink-200 transition hover:bg-white/10 hover:text-white"
            onClick={() => toggleQuickStart(false)}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="mt-3 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                {s.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-200">{s.body}</p>
                {s.action && (
                  <button
                    onClick={s.action.onClick}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-tide-400 hover:text-tide-300"
                  >
                    {s.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
