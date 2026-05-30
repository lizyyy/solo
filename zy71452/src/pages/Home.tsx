import { BridgeScene } from '@/components/three/BridgeScene';
import { ControlPanel } from '@/components/ControlPanel';
import { LoadPanel } from '@/components/LoadPanel';
import { DetailPanel } from '@/components/DetailPanel';
import { DiagnosticPanel } from '@/components/DiagnosticPanel';
import { ImportPanel } from '@/components/ImportPanel';
import { useBridgeStore } from '@/store/useBridgeStore';
import { Info } from 'lucide-react';

export default function Home() {
  const model = useBridgeStore(state => state.model);
  const currentMode = useBridgeStore(state => state.modeShape.currentOrder);
  const load = useBridgeStore(state => state.load);

  return (
    <div className="w-full h-screen bg-slate-900 relative overflow-hidden">
      <div id="screenshot-area" className="w-full h-full">
        <BridgeScene />
      </div>
      
      <div className="fixed top-4 left-4 z-10">
        <h1 className="text-xl font-bold text-white tracking-tight">
          桥梁振型演示器
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          {model?.name || '加载中...'}
        </p>
      </div>
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-700/50">
          <div className="text-xs text-zinc-400">
            <span className="text-zinc-500">振型:</span>
            <span className="text-blue-400 font-mono ml-1">第{currentMode}阶</span>
          </div>
          <div className="w-px h-4 bg-zinc-700" />
          <div className="text-xs text-zinc-400">
            <span className="text-zinc-500">荷载:</span>
            <span className="text-orange-400 font-mono ml-1">{load.magnitude}吨</span>
          </div>
          <div className="w-px h-4 bg-zinc-700" />
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Info className="w-3 h-3" />
            <span>拖拽旋转 · 滚轮缩放 · 点击选中</span>
          </div>
        </div>
      </div>
      
      <div className="fixed left-4 top-20 z-10">
        <ControlPanel />
      </div>
      
      <div className="fixed right-4 top-20 z-10">
        <LoadPanel />
      </div>
      
      <DiagnosticPanel />
      <DetailPanel />
      <ImportPanel />
    </div>
  );
}
