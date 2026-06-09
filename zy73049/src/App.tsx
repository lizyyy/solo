import { useEffect } from "react";
import { ThresholdPanel } from "@/components/ThresholdPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { TrendChart } from "@/components/TrendChart";
import { DetailModal } from "@/components/DetailModal";
import { MaterialDrawer } from "@/components/MaterialDrawer";
import { initStore, useAppStore } from "@/store/useAppStore";
import { SAMPLE_PACKS } from "@/data/mockData";

export default function App() {
  const recompute = useAppStore((s) => s.recompute);
  const packId = useAppStore((s) => s.packId);
  const pack = SAMPLE_PACKS.find((p) => p.id === packId);

  useEffect(() => {
    initStore();
  }, []);

  return (
    <div className="h-screen w-screen flex overflow-hidden font-mono text-white">
      <ThresholdPanel />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60 bg-ink-900/40 backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <div className="font-serif text-xl text-white">异常归因总览</div>
            <div className="text-[11px] text-ink-600 font-mono">
              试样包：
              <span className="text-white/80">{pack?.name}</span>
              {pack?.hasBoundary && (
                <span className="ml-2 text-alert-amber">· 含边界样本</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-ink-600 font-mono flex items-center gap-4">
            <span>
              <span className="text-alert-green">绿线</span> = 反掩盖后稳健均值
            </span>
            <span>
              <span className="text-alert-orange">气泡</span> = 异常/边界样本
            </span>
            <button
              onClick={recompute}
              className="px-2 py-1 rounded border border-ink-700 text-ink-500 hover:text-white hover:border-ink-600 transition"
            >
              重算
            </button>
          </div>
        </header>

        <section className="p-6 pb-4">
          <SummaryCards />
        </section>

        <section className="px-6 pb-6 flex-1 min-h-0">
          <TrendChart />
        </section>
      </main>

      <MaterialDrawer />
      <DetailModal />
    </div>
  );
}
