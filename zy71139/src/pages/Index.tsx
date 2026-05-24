import React, { useState, useEffect } from 'react';
import { Menu, FolderOpen, FileText, Flame } from 'lucide-react';
import { TunnelScene } from '../three/TunnelScene';
import { ControlPanel } from '../components/ControlPanel';
import { Timeline } from '../components/Timeline';
import { StatusPanel } from '../components/StatusPanel';
import { ViewControls } from '../components/ViewControls';
import { SceneSelector } from '../components/SceneSelector';
import { ReportModal } from '../components/ReportModal';
import { initializeDefaultScene } from '../store/useSimulationStore';
import { cn } from '../utils/cn';

const Index: React.FC = () => {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isSceneSelectorOpen, setIsSceneSelectorOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    initializeDefaultScene();
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden">
      <header className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white lg:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Flame size={20} className="text-orange-400" />
            <h1 className="text-white font-semibold text-sm sm:text-base">
              隧道通风烟气演练系统
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSceneSelectorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs sm:text-sm rounded-lg transition-colors"
          >
            <FolderOpen size={14} />
            <span className="hidden sm:inline">场景</span>
          </button>
          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded-lg transition-colors shadow-lg shadow-orange-500/30"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">报告</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={cn(
          "hidden lg:block flex-shrink-0",
          isPanelCollapsed ? "w-12" : "w-72"
        )}>
          <ControlPanel 
            isCollapsed={isPanelCollapsed} 
            onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
          />
        </div>

        {isPanelCollapsed && (
          <div className="lg:hidden fixed inset-y-12 left-0 z-40 w-72">
            <ControlPanel 
              isCollapsed={false} 
              onToggleCollapse={() => setIsPanelCollapsed(true)}
            />
          </div>
        )}

        <main className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0">
            <TunnelScene />
          </div>

          <StatusPanel />
          <ViewControls />
        </main>
      </div>

      <footer className="flex-shrink-0">
        <Timeline />
      </footer>

      <SceneSelector 
        isOpen={isSceneSelectorOpen} 
        onClose={() => setIsSceneSelectorOpen(false)} 
      />
      <ReportModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
      />
    </div>
  );
};

export default Index;
