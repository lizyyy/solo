import DeepSeaCanvas from "@/components/three/DeepSeaCanvas";
import CsvDrawer from "@/components/cockpit/CsvDrawer";
import FilterPanel from "@/components/cockpit/FilterPanel";
import ObjectDetailPanel from "@/components/cockpit/ObjectDetailPanel";
import Timeline from "@/components/cockpit/Timeline";
import { useOceanStore } from "@/store/useOceanStore";
import { STATIONS } from "@/store/useOceanStore";

function SceneOverlay() {
  const selectedId = useOceanStore((s) => s.selectedSampleId);
  const samples = useOceanStore((s) => s.samples);
  const sample = samples.find((s) => s.id === selectedId);
  const station = STATIONS.find((st) => st.id === sample?.stationId);

  return (
    <>
      {/* top-left HUD */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="glass clip-corner rounded-lg px-3 py-2">
          <div className="hud-label">深海采样异常预警 · 驾驶舱</div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
            {selectedId
              ? `已选中 ${sample?.code} · ${station?.name} · 深度 ${sample?.depth}m`
              : "点选场景中的采样节点 → 联动时间轴 / 筛选 / CSV"}
          </div>
        </div>
      </div>

      {/* scan-line decoration */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-40">
        <div className="absolute inset-x-0 h-px animate-scan bg-gradient-to-r from-transparent via-glow-cyan/40 to-transparent" />
      </div>

      {/* bottom timeline */}
      <div className="absolute inset-x-4 bottom-4 z-10">
        <Timeline />
      </div>

      <CsvDrawer />
    </>
  );
}

export default function Home() {
  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="relative min-w-0 flex-1">
        <DeepSeaCanvas />
        <SceneOverlay />
      </div>
      <aside className="flex w-[372px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-glow-cyan/10 bg-abyss-950/60 p-3 backdrop-blur-xl">
        <ObjectDetailPanel />
        <FilterPanel />
      </aside>
    </div>
  );
}
