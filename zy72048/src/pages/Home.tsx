import ConfigPanel from "@/components/ConfigPanel";
import RunConsole from "@/components/RunConsole";
import RecordDetail from "@/components/RecordDetail";
import SettlementReport from "@/components/SettlementReport";
import { useGameStore } from "@/store/useGameStore";

export default function Home() {
  const configErrors = useGameStore((s) => s.configErrors);
  const hasFatalError = configErrors.some((e) =>
    e.includes("资源配置异常")
  );

  return (
    <div className="min-h-screen bg-chalk chalk-texture">
      <header className="bg-cliff text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧗</span>
            <div>
              <h1 className="font-display text-2xl leading-tight">
                三角函数攀岩馆
              </h1>
              <p className="text-sm opacity-80">
                活动策划阿蓝 · 练习记录校验工具
              </p>
            </div>
          </div>
          <div className="text-right text-xs opacity-60">
            <div>三角函数攀岩馆</div>
            <div>校验判断 v1.0</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <RunConsole />

        {hasFatalError && (
          <div className="bg-red-50 border-2 border-danger rounded-xl p-4 text-sm text-danger">
            <strong>配置严重异常：</strong>部分关卡的资源边界最小值大于最大值，
            这会导致资源值校验不可靠。工具仍可运行，但资源范围检查结果仅供参考。
            建议联系阿蓝修正配置后再使用。
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ConfigPanel />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <RecordDetail />
            <SettlementReport />
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-gray-400 border-t border-warm">
        三角函数攀岩馆 · 校验工具 · 保留原始数据 · 不做清洗 · 可追溯 · 同事语气
      </footer>
    </div>
  );
}
