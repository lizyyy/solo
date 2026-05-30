import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { AlertBar } from './AlertBar';
import { SwingScene } from '@/components/scene3d/SwingScene';
import { Timeline } from '@/components/timeline/Timeline';
import { ParameterPanel } from '@/components/panels/ParameterPanel';
import { AnomalyPanel } from '@/components/panels/AnomalyPanel';
import { KeyframePanel } from '@/components/panels/KeyframePanel';
import { ComparisonPanel } from '@/components/panels/ComparisonPanel';
import { ReportPanel } from '@/components/panels/ReportPanel';
import { SupplementPanel } from '@/components/panels/SupplementPanel';
import { VersionHistoryPanel } from '@/components/panels/VersionHistoryPanel';
import { useSwingStore } from '@/store/useSwingStore';

export function MainLayout() {
  const { activePanel, loadSessions, currentSession } = useSwingStore();
  
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  
  const renderRightPanel = () => {
    switch (activePanel) {
      case 'params':
        return <ParameterPanel />;
      case 'anomalies':
        return <AnomalyPanel />;
      case 'keyframes':
        return <KeyframePanel />;
      case 'compare':
        return <ComparisonPanel />;
      case 'report':
        return <ReportPanel />;
      case 'supplement':
        return <SupplementPanel />;
      case 'history':
        return <VersionHistoryPanel />;
      default:
        return <ParameterPanel />;
    }
  };
  
  return (
    <div className="h-screen w-screen flex flex-col bg-golf-bg overflow-hidden">
      <TopBar />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <AlertBar />
          
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative">
              <SwingScene />
              
              {!currentSession && (
                <div className="absolute inset-0 flex items-center justify-center bg-golf-bg/80">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-golf-bg-light flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-golf-border border-t-golf-blue rounded-full animate-spin" />
                    </div>
                    <p className="text-golf-text-muted text-sm">正在加载数据...</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-80 bg-golf-bg-light border-l border-golf-border flex-shrink-0">
              {renderRightPanel()}
            </div>
          </div>
          
          <Timeline />
        </div>
      </div>
    </div>
  );
}
