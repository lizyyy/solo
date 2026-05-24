import { useState } from 'react';
import * as THREE from 'three';
import { Toolbar } from './components/Toolbar/Toolbar';
import { FilterPanel } from './components/ControlPanel/FilterPanel';
import { BridgeScene } from './components/BridgeScene/BridgeScene';
import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { Timeline } from './components/Timeline/Timeline';
import { useInspectionStore } from './store/inspectionStore';

function App() {
  const [glRenderer, setGlRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const { sampleDataLoaded } = useInspectionStore();

  const handleSceneReady = (gl: THREE.WebGLRenderer) => {
    setGlRenderer(gl);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <Toolbar glRenderer={glRenderer} />

      <div className="flex-1 flex overflow-hidden">
        {sampleDataLoaded && <FilterPanel />}

        <div className="flex-1 relative">
          {sampleDataLoaded ? (
            <BridgeScene onSceneReady={handleSceneReady} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">桥梁裂缝巡检对齐系统</h2>
                <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
                  点击上方"导入样例数据"按钮开始使用，体验3D桥梁模型与裂缝点位可视化
                </p>
                <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                  <span>• 支持多批次巡检历史对比</span>
                  <span>• 裂缝状态追踪与维修记录</span>
                  <span>• 一键导出一致性巡检报告</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {sampleDataLoaded && <DetailPanel />}
      </div>

      {sampleDataLoaded && <Timeline />}
    </div>
  );
}

export default App;
