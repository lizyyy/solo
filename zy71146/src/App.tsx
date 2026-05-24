import { useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { MallScene } from '@/scenes/MallScene';
import { TopBar } from '@/components/layout/TopBar';
import { LeftToolbar } from '@/components/toolbar/LeftToolbar';
import { RightPanel } from '@/components/panel/RightPanel';
import { Timeline } from '@/components/timeline/Timeline';
import { SampleModal } from '@/components/modal/SampleModal';
import { useSceneStore } from '@/store/sceneStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useUIStore } from '@/store/uiStore';
import { generateReportSnapshot, exportPDFReport, exportJSONReport, captureScreenshot } from '@/utils/reportExport';

function App() {
  const cameraPosition = useSceneStore(state => state.cameraPosition);
  const cameraRotation = useSceneStore(state => state.cameraRotation);
  const currentTime = useSceneStore(state => state.currentTime);
  const elements = useSceneStore(state => state.elements);
  const currentScene = useSceneStore(state => state.currentScene);
  
  const blindSpots = useAnalysisStore(state => state.blindSpots);
  const filters = useAnalysisStore(state => state.filters);
  
  const setSampleModalOpen = useUIStore(state => state.setSampleModalOpen);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSampleModalOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [setSampleModalOpen]);

  const handleExportReport = useCallback(async () => {
    const screenshot = await captureScreenshot('#canvas-container');
    const visibleElements = elements.filter(el => el.visible).map(el => el.id);
    
    const snapshot = generateReportSnapshot(
      cameraPosition,
      cameraRotation,
      filters,
      currentTime,
      blindSpots,
      visibleElements,
      currentScene?.name || '未命名场景',
      screenshot
    );
    
    await exportPDFReport(snapshot);
  }, [cameraPosition, cameraRotation, filters, currentTime, blindSpots, elements, currentScene]);

  const handleExportJSON = useCallback(() => {
    const visibleElements = elements.filter(el => el.visible).map(el => el.id);
    
    const snapshot = generateReportSnapshot(
      cameraPosition,
      cameraRotation,
      filters,
      currentTime,
      blindSpots,
      visibleElements,
      currentScene?.name || '未命名场景'
    );
    
    exportJSONReport(snapshot);
  }, [cameraPosition, cameraRotation, filters, currentTime, blindSpots, elements, currentScene]);

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden relative">
      <div id="canvas-container" className="w-full h-full">
        <Canvas
          shadows
          camera={{ position: [0, 15, 20], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#0a0a1a']} />
          <fog attach="fog" args={['#0a0a1a', 30, 80]} />
          
          <MallScene />
          
          <EffectComposer>
            <Bloom
              intensity={0.3}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <Vignette
              offset={0.3}
              darkness={0.5}
            />
          </EffectComposer>
        </Canvas>
      </div>

      <TopBar onExportReport={handleExportReport} onExportJSON={handleExportJSON} />
      <LeftToolbar />
      <RightPanel />
      <Timeline />
      <SampleModal />

      <div className="absolute bottom-28 left-4 z-10 text-xs text-slate-500 font-mono">
        <div className="bg-slate-900/70 backdrop-blur-sm px-3 py-2 rounded-lg">
          <div>鼠标左键: 旋转 | 右键: 平移 | 滚轮: 缩放</div>
          <div>点击元素选择 | 点击盲区标记查看详情</div>
        </div>
      </div>
    </div>
  );
}

export default App;
