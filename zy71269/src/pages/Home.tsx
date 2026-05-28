import { Scene3D } from '@/components/view3d/Scene3D';
import { SidePanel } from '@/components/sidebar/SidePanel';
import { ColorScaleBar } from '@/components/controls/ColorScaleBar';
import { SectionController } from '@/components/controls/SectionController';
import { Toolbar } from '@/components/controls/Toolbar';
import { useThermalStore } from '@/store/useThermalStore';
import { Cpu, Info } from 'lucide-react';

export default function Home() {
  const { chipPackage } = useThermalStore();

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50 flex items-center px-4 justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">芯片封装热岛视图</h1>
            <p className="text-xs text-slate-400">{chipPackage.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4" />
            <span>拖动旋转 · 滚轮缩放 · 点击选中</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="text-xs text-slate-400">
            版本: <span className="text-cyan-400 font-medium">{chipPackage.versionHistory[chipPackage.versionHistory.length - 1].version}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative">
          <Scene3D />
          <Toolbar />
          <ColorScaleBar />
          <SectionController />

          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-lg px-3 py-2 border border-slate-700/50">
              <div className="text-[10px] text-slate-400 mb-1">版本历史</div>
              <div className="text-xs text-slate-300">
                {chipPackage.versionHistory[chipPackage.versionHistory.length - 1].changes}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {chipPackage.versionHistory[chipPackage.versionHistory.length - 1].author} · {chipPackage.versionHistory[chipPackage.versionHistory.length - 1].timestamp.slice(0, 10)}
              </div>
            </div>
          </div>
        </div>

        <SidePanel />
      </div>
    </div>
  );
}
