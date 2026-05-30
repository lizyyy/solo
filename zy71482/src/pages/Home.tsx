import { ControlPanel } from '../components/ControlPanel/ControlPanel';
import { AnalysisPanel } from '../components/AnalysisPanel/AnalysisPanel';
import { ThreeDCanvas } from '../components/ThreeDCanvas/ThreeDCanvas';

export default function Home() {
  return (
    <div className="h-screen w-screen flex bg-gray-950 overflow-hidden">
      <ControlPanel />
      <div className="flex-1 relative">
        <ThreeDCanvas />
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/80 backdrop-blur rounded-lg text-xs text-gray-400">
          鼠标左键拖拽旋转 · 滚轮缩放 · 右键平移
        </div>
      </div>
      <AnalysisPanel />
    </div>
  );
}
