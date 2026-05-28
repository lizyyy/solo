import { useRef, useState } from 'react';
import { Atom, Layers, LineChart, Settings, Menu, X } from 'lucide-react';
import { EnergyTower } from '@/components/Scene/EnergyTower';
import { EnergyLevelList } from '@/components/DataPanel/EnergyLevelList';
import { TransitionList } from '@/components/DataPanel/TransitionList';
import { ExternalField } from '@/components/DataPanel/ExternalField';
import { SpectrumDisplay } from '@/components/Spectrum/SpectrumDisplay';
import { ValidationPanel } from '@/components/Validation/ValidationPanel';
import { IssueTracker } from '@/components/IssueTracker/IssueTracker';
import { ScreenshotExport } from '@/components/Export/ScreenshotExport';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';

type TabType = 'energy' | 'transition' | 'field';

export default function Home() {
  const appRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('energy');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const { selectedLevel, activeTransition } = useAppStore();

  const tabs = [
    { id: 'energy' as TabType, label: '能级', icon: Atom },
    { id: 'transition' as TabType, label: '跃迁', icon: LineChart },
    { id: 'field' as TabType, label: '外场', icon: Settings },
  ];

  return (
    <div ref={appRef} className="w-screen h-screen flex flex-col bg-space-950 text-slate-200">
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/80 backdrop-blur-sm relative z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors mr-2"
          >
            {leftPanelCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Atom size={28} className="text-cyan-400" />
            <div>
              <h1 className="font-display text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                量子能级跃迁塔
              </h1>
              <p className="text-xs text-slate-500 -mt-1">Quantum Energy Level Tower
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {selectedLevel !== null && (
            <div className="text-sm">
              <span className="text-slate-400">当前选中: </span>
              <span className="text-cyan-400 font-mono">n = {useAppStore.getState().energyLevels.find(l => l.id === selectedLevel)?.n}
              </span>
            </div>
          )}
          {activeTransition !== null && (
            <div className="text-sm">
              <span className="text-slate-400">跃迁: </span>
              <span className="text-green-400 font-mono">
                {(() => {
                  const t = useAppStore.getState().transitions.find(tr => tr.id === activeTransition);
                  const fromN = useAppStore.getState().energyLevels.find(l => l.id === t?.from_level)?.n;
                  const toN = useAppStore.getState().energyLevels.find(l => l.id === t?.to_level)?.n;
                  return `n=${fromN} → n=${toN}`;
                })()}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={cn(
            "border-r border-slate-800 bg-slate-900/50 flex flex-col transition-all duration-300",
            leftPanelCollapsed ? "w-0 overflow-hidden" : "w-[340px]"
          )}
        >
          <div className="flex border-b border-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                  activeTab === tab.id
                    ? "bg-slate-800 text-cyan-400 border-b-2 border-cyan-400"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {activeTab === 'energy' && <EnergyLevelList />}
            {activeTab === 'transition' && <TransitionList />}
            {activeTab === 'field' && <ExternalField />}
          </div>
        </aside>

        <main className="flex-1 relative">
          <EnergyTower />
        </main>

        <aside className="w-[340px] border-l border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <SpectrumDisplay />
            <ValidationPanel />
            <IssueTracker />
            <ScreenshotExport targetRef={appRef} />
          </div>
        </aside>
      </div>
    </div>
  );
}
