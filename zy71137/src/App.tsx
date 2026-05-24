import { MainScene } from '@/components/3d/MainScene';
import { TopBar } from '@/components/ui/TopBar';
import { ControlPanel } from '@/components/ui/ControlPanel';
import { Timeline } from '@/components/ui/Timeline';
import { AlertPanel } from '@/components/ui/AlertPanel';

function App() {
  return (
    <div className="w-full h-screen bg-gray-950 relative overflow-hidden">
      <div className="absolute inset-0">
        <MainScene />
      </div>

      <TopBar />
      <ControlPanel />
      <AlertPanel />
      <Timeline />

      <div className="absolute bottom-24 right-4 text-xs text-gray-500 bg-gray-900/70 backdrop-blur-sm px-3 py-2 rounded-lg z-10">
        <div className="font-medium text-gray-400 mb-1">操作提示</div>
        <div>🖱️ 左键拖拽旋转视角</div>
        <div>🔍 滚轮缩放</div>
        <div>➡️ 右键平移</div>
      </div>
    </div>
  );
}

export default App;