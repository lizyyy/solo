import { LeftPanel } from './components/ui/LeftPanel';
import { RightPanel } from './components/ui/RightPanel';
import { BottomBar } from './components/ui/BottomBar';
import { YardScene } from './components/three/YardScene';
import './index.css';

function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <div className="flex-1 relative">
          <YardScene />
          <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm">
            <span className="text-gray-400">提示：</span>
            <span className="text-gray-300 ml-1">
              点击集装箱进行可达性分析 | 拖拽旋转场景 | 滚轮缩放
            </span>
          </div>
        </div>
        <RightPanel />
      </div>
      <BottomBar />
    </div>
  );
}

export default App;
