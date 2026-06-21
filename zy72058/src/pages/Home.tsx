import { useCallback } from 'react';
import { useStore, useFilteredComponents, useSelectedComponent } from '@/store/useStore';
import { ThreeScene } from '@/components/ThreeScene/Scene';
import { LeftPanel } from '@/components/Panel/LeftPanel';
import { RightPanel } from '@/components/Panel/RightPanel';
import { Toolbar } from '@/components/Panel/Toolbar';

export default function Home() {
  const { leftPanelOpen, rightPanelOpen, cameraState, setCameraState, selectedComponentId, setSelectedComponent, setThreeCanvas } = useStore();
  const filteredComponents = useFilteredComponents();
  const selectedComponent = useSelectedComponent();

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setThreeCanvas(canvas);
  }, [setThreeCanvas]);

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        {leftPanelOpen && <LeftPanel />}
        <div className="flex-1 relative">
          <ThreeScene
            components={filteredComponents}
            selectedComponentId={selectedComponentId}
            selectedComponent={selectedComponent}
            cameraState={cameraState}
            onCameraChange={setCameraState}
            onSelectComponent={setSelectedComponent}
            onCanvasReady={handleCanvasReady}
          />
          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
            <div>鼠标左键: 旋转视角 | 滚轮: 缩放 | 右键: 平移</div>
          </div>
        </div>
        {rightPanelOpen && <RightPanel />}
      </div>
    </div>
  );
}
