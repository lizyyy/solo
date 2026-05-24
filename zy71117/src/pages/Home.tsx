import { Scene3D } from '../components/Scene3D/Scene3D';
import { ControlPanel } from '../components/ControlPanel/ControlPanel';
import { TopToolbar } from '../components/TopToolbar/TopToolbar';
import { Timeline } from '../components/Timeline/Timeline';
import { InfoPanel } from '../components/InfoPanel/InfoPanel';

export default function Home() {
  return (
    <div className="w-full h-screen bg-gray-950 relative overflow-hidden">
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl shadow-lg">
          <h1 className="text-lg font-bold">🚚 装卸月台转弯模拟</h1>
        </div>
      </div>

      <Scene3D />

      <TopToolbar />
      <ControlPanel />
      <InfoPanel />
      <Timeline />

      <div className="absolute bottom-24 left-4 text-xs text-gray-500 z-10">
        <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-2 space-y-1">
          <div>🖱️ 左键拖拽: 旋转视角</div>
          <div>🔍 滚轮: 缩放</div>
          <div>➡️ 右键拖拽: 平移</div>
        </div>
      </div>
    </div>
  );
}
