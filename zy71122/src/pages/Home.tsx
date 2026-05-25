import { useState } from 'react';
import { NetworkCanvas } from '@/components/NetworkScene/NetworkCanvas';
import { ScenarioSelector } from '@/components/ControlPanel/ScenarioSelector';
import { ViewControls } from '@/components/ControlPanel/ViewControls';
import { ImpactAnalysisPanel } from '@/components/ControlPanel/ImpactAnalysis';
import { SolutionManager } from '@/components/ControlPanel/SolutionManager';
import { SolutionComparison } from '@/components/ControlPanel/SolutionComparison';
import { Timeline } from '@/components/ControlPanel/Timeline';
import { useNetworkStore } from '@/store/useNetworkStore';
import { Layers, Map, AlertTriangle, Save, ChevronLeft, ChevronRight } from 'lucide-react';

type PanelTab = 'scenario' | 'view' | 'analysis' | 'solution';

const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
  { id: 'scenario', label: '场景', icon: <Map className="w-4 h-4" /> },
  { id: 'view', label: '视图', icon: <Layers className="w-4 h-4" /> },
  { id: 'analysis', label: '分析', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'solution', label: '方案', icon: <Save className="w-4 h-4" /> },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<PanelTab>('scenario');
  const [panelExpanded, setPanelExpanded] = useState(true);
  const { currentScenario, showComparison } = useNetworkStore();

  const renderPanelContent = () => {
    switch (activeTab) {
      case 'scenario':
        return <ScenarioSelector />;
      case 'view':
        return <ViewControls />;
      case 'analysis':
        return <ImpactAnalysisPanel />;
      case 'solution':
        return <SolutionManager />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <header className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">管网阀门隔离演练</h1>
            <p className="text-xs text-slate-400">Water Network Isolation Simulation</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400">
            当前场景: <span className="text-cyan-400 font-medium">{currentScenario.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">图例:</span>
            <div className="flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-400">开启</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-400">关闭</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-400">失效</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`bg-slate-900/60 backdrop-blur-sm border-r border-slate-700/50 flex flex-col transition-all duration-300 ${
            panelExpanded ? 'w-72' : 'w-12'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
            {panelExpanded && (
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      activeTab === tab.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setPanelExpanded(!panelExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-slate-300 transition-all"
            >
              {panelExpanded ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>

          {panelExpanded ? (
            <div className="flex-1 overflow-y-auto p-4">
              {renderPanelContent()}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center py-4 gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPanelExpanded(true);
                  }}
                  className={`p-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
                  title={tab.label}
                >
                  {tab.icon}
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 relative">
          <NetworkCanvas />

          <div className="absolute top-4 right-4 text-xs text-slate-400/60 bg-slate-900/50 px-3 py-2 rounded-lg backdrop-blur-sm">
            <div>🖱️ 左键拖动旋转 | 滚轮缩放 | 右键平移</div>
            <div>🔘 点击阀门切换开关状态</div>
          </div>
        </main>
      </div>

      <Timeline />

      {showComparison && <SolutionComparison />}
    </div>
  );
}
