import { useRef, useEffect } from 'react';
import Scene3D from './components/Scene3D/Scene3D';
import TopToolbar from './components/UI/TopToolbar';
import LeftPanel from './components/UI/LeftPanel';
import RightPanel from './components/UI/RightPanel';
import Timeline from './components/UI/Timeline';
import ViewSwitcher from './components/UI/ViewSwitcher';
import { useSceneStore } from './store/useSceneStore';
import { useResponsive } from './hooks/useResponsive';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const updateRisks = useSceneStore(state => state.updateRisks);
  const setLeftPanelOpen = useSceneStore(state => state.setLeftPanelOpen);
  const setRightPanelOpen = useSceneStore(state => state.setRightPanelOpen);
  const { isNarrow } = useResponsive();
  
  useEffect(() => {
    if (isNarrow) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    } else {
      setLeftPanelOpen(true);
      setRightPanelOpen(true);
    }
  }, [isNarrow, setLeftPanelOpen, setRightPanelOpen]);
  
  useEffect(() => {
    updateRisks();
  }, [updateRisks]);

  return (
    <div className="w-full h-full relative bg-dark-100 overflow-hidden">
      <div className="absolute inset-0 pt-14 pb-20">
        <Scene3D canvasRef={canvasRef} />
      </div>
      
      <TopToolbar canvasRef={canvasRef} />
      <LeftPanel />
      <RightPanel />
      <Timeline />
      <ViewSwitcher />
      
      <div className="absolute bottom-24 right-4 z-10 hidden md:block">
        <div className="glass-panel rounded-lg p-3 max-w-xs">
          <div className="text-white text-sm font-medium mb-2">操作提示</div>
          <div className="text-gray-400 text-xs space-y-1">
            <p>🖱️ 鼠标左键拖拽旋转视角</p>
            <p>🖱️ 鼠标滚轮缩放场景</p>
            <p>🖱️ 鼠标右键平移视角</p>
            <p>⚙️ 左侧面板调整参数</p>
            <p>⚠️ 右侧面板查看风险</p>
          </div>
        </div>
      </div>

      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10 md:hidden">
        <div className="glass-panel rounded-full px-3 py-1 text-xs text-gray-400">
          双指缩放 · 单指旋转
        </div>
      </div>
    </div>
  );
}

export default App;
