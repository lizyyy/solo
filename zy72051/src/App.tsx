import { ThreeScene } from './components/three/Scene';
import { FilterBar } from './components/ui/FilterBar';
import { Timeline } from './components/ui/Timeline';
import { SidePanel } from './components/ui/SidePanel';
import { StatusBar } from './components/ui/StatusBar';

export default function App() {
  return (
    <div id="sandbox-container" className="h-full w-full flex flex-col bg-[#0a1628] relative">
      <FilterBar />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          <ThreeScene />
          <StatusBar />
          <div className="absolute top-4 right-4 z-20 pointer-events-none">
            <div className="bg-[#0a1628]/90 backdrop-blur-sm border border-[#2a3a5a] rounded px-4 py-2">
              <h1 className="font-title text-[#ffb347] text-lg font-semibold tracking-wider">
                城市天际线日照沙盘
              </h1>
              <div className="text-xs text-[#5a6a80] mt-0.5">
                Sunlight Analysis Sandbox v1.0
              </div>
            </div>
          </div>
        </div>
        <SidePanel />
      </div>
      <Timeline />
    </div>
  );
}
