import React, { useRef, useState, useCallback } from 'react';
import Scene3D, { Scene3DHandle } from './components/Scene3D/Scene3D';
import ParamSliders from './components/Controls/ParamSliders';
import ForcePanel from './components/Controls/ForcePanel';
import StatusPanel from './components/Controls/StatusPanel';
import FloatingMenu from './components/UI/FloatingMenu';
import ObjectInfo from './components/UI/ObjectInfo';
import ErrorTrace from './components/UI/ErrorTrace';
import { useExperimentStore } from './store/useExperimentStore';
import { generateReport, downloadReport, takeScreenshot } from './utils/export';
import { BookOpen, Github } from 'lucide-react';

const App: React.FC = () => {
  const sceneRef = useRef<Scene3DHandle>(null);
  const [activeTab, setActiveTab] = useState<'params' | 'forces' | 'status'>('params');
  const experimentState = useExperimentStore();

  const handleScreenshot = useCallback(async () => {
    const canvas = sceneRef.current?.getCanvas();
    if (canvas) {
      try {
        await takeScreenshot(canvas);
      } catch (error) {
        console.error('截图失败:', error);
      }
    }
  }, []);

  const handleExportReport = useCallback(() => {
    const state = useExperimentStore.getState();
    const report = generateReport(state);
    downloadReport(report);
  }, []);

  const tabs = [
    { id: 'params' as const, label: '参数', icon: '🎚️' },
    { id: 'forces' as const, label: '受力', icon: '📐' },
    { id: 'status' as const, label: '判定', icon: '🎯' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-dark-950 overflow-hidden">
      <header className="flex-shrink-0 h-14 border-b border-dark-800/50 bg-dark-900/80 backdrop-blur-sm flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="title-font font-bold text-lg text-dark-100 tracking-wide">
              摩擦斜面课堂器
            </h1>
            <p className="text-[10px] text-dark-500 -mt-0.5">
              初中物理 · 静摩擦力实验
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-xs text-dark-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-static animate-pulse" />
              静止
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-critical animate-pulse" />
              临界
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-sliding animate-pulse" />
              滑动
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          <Scene3D ref={sceneRef} />

          <FloatingMenu
            onScreenshot={handleScreenshot}
            onExportReport={handleExportReport}
          />

          <ObjectInfo />

          <ErrorTrace />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="glass rounded-full px-4 py-2 flex items-center gap-6 text-xs text-dark-400">
              <span className="flex items-center gap-1.5">
                <span className="text-dark-300">🖱️</span> 左键旋转
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-dark-300">⚙️</span> 滚轮缩放
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-dark-300">👆</span> 点击查看
              </span>
            </div>
          </div>
        </div>

        <aside className="w-[380px] flex-shrink-0 bg-dark-900/50 border-l border-dark-800/50 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 p-3 border-b border-dark-800/50">
            <div className="flex bg-dark-800/50 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all btn-click ${
                    activeTab === tab.id
                      ? 'bg-dark-700 text-primary-400 shadow-sm'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  <span className="mr-1.5">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {activeTab === 'params' && <ParamSliders />}
              {activeTab === 'forces' && <ForcePanel />}
              {activeTab === 'status' && <StatusPanel />}
            </div>
          </div>

          <div className="flex-shrink-0 p-4 border-t border-dark-800/50 bg-dark-900/80">
            <div className="text-xs text-dark-500 space-y-1">
              <div className="flex items-center justify-between">
                <span>当前状态</span>
                <span
                  className="font-semibold value-display"
                  style={{ color: experimentState.threshold.status === 'static' ? '#10B981' : experimentState.threshold.status === 'critical' ? '#F59E0B' : '#EF4444' }}
                >
                  {experimentState.threshold.status === 'static' ? '静止' : experimentState.threshold.status === 'critical' ? '临界' : '滑动'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>临界角度</span>
                <span className="font-semibold value-display text-yellow-400">
                  {experimentState.threshold.criticalAngle.toFixed(2)}°
                </span>
              </div>
              <div className="pt-2 border-t border-dark-800/50 mt-2">
                <div className="font-mono text-[10px] text-dark-600">
                  θ_c = arctan(μ) = {experimentState.threshold.criticalAngle.toFixed(2)}°
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
