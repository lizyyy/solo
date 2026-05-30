import { ThreeScene } from '../components/three/Scene';
import { MenuBar } from '../components/ui/MenuBar';
import { TimeSlider } from '../components/ui/TimeSlider';
import { ViewSwitcher } from '../components/ui/ViewSwitcher';
import { BottleneckPanel } from '../components/ui/BottleneckPanel';
import { ConflictPanel } from '../components/ui/ConflictPanel';
import { ReportModal } from '../components/ui/ReportModal';

export default function Home() {
  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950 relative">
      <ThreeScene />

      <MenuBar />
      <TimeSlider />
      <ViewSwitcher />
      <BottleneckPanel />
      <ConflictPanel />
      <ReportModal />

      <div className="fixed bottom-28 right-4 z-40">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 shadow-xl">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cyan-400" />
              <span className="text-slate-400">正常</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-slate-400">预警</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-slate-400">告警</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-purple-400" />
              <span className="text-slate-400">冲突</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
