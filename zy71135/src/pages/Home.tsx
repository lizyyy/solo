import { Ship } from 'lucide-react';
import { ThreeScene } from '../components/three/Scene';
import { CargoList } from '../components/ui/CargoList';
import { ControlPanel } from '../components/ui/ControlPanel';
import { StatusBar } from '../components/ui/StatusBar';
import { Timeline } from '../components/ui/Timeline';
import { useStore } from '../store/useStore';
import { useEffect } from 'react';

export default function Home() {
  const recalculate = useStore((state) => state.recalculate);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="bg-gray-900 px-6 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ship className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">船舱装载平衡模拟器</h1>
            <p className="text-xs text-gray-400">Ship Load Balance Simulator</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          3D 交互可视化 · 实时重心计算 · 规则校验
        </div>
      </header>

      <ControlPanel />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-gray-700 flex-shrink-0">
          <CargoList />
        </aside>

        <main className="flex-1 relative">
          <ThreeScene />

          <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur p-3 rounded-lg border border-gray-700 text-xs">
            <div className="font-medium mb-2 text-gray-300">图例</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-gray-400">重货</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-teal-500" />
                <span className="text-gray-400">冷藏箱</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-gray-400">危险品</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gray-600" />
                <span className="text-gray-400">空舱位</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 rounded bg-teal-400" />
                <span className="text-gray-400">带电源舱位</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-700 text-gray-500">
              <div>左键: 选择/装载</div>
              <div>滚轮: 缩放</div>
              <div>右键拖拽: 旋转</div>
            </div>
          </div>
        </main>
      </div>

      <Timeline />
      <StatusBar />
    </div>
  );
}
