import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import WarehouseScene from '../components/three/WarehouseScene';
import FilterPanel from '../components/ui/FilterPanel';
import InfoPanel from '../components/ui/InfoPanel';
import Toolbar from '../components/ui/Toolbar';
import StatusBar from '../components/ui/StatusBar';
import ReportModal from '../components/ui/ReportModal';

export default function Home() {
  const [showReportModal, setShowReportModal] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | undefined>();
  const sceneRef = useRef<HTMLDivElement>(null);

  const handleExportScreenshot = useCallback(async () => {
    if (!sceneRef.current) return;
    
    try {
      const canvas = await html2canvas(sceneRef.current, {
        backgroundColor: '#0F172A',
        scale: 2,
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `仓库孪生截图_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('截图导出失败:', error);
    }
  }, []);

  const handleExportReport = useCallback(async () => {
    if (sceneRef.current) {
      try {
        const canvas = await html2canvas(sceneRef.current, {
          backgroundColor: '#0F172A',
          scale: 1.5,
          logging: false
        });
        setScreenshotData(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('报告截图生成失败:', error);
      }
    }
    setShowReportModal(true);
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      <div className="flex-1 flex relative overflow-hidden">
        <FilterPanel />
        
        <div ref={sceneRef} className="flex-1 relative">
          <WarehouseScene />
          
          <Toolbar 
            onExportScreenshot={handleExportScreenshot}
            onExportReport={handleExportReport}
          />
        </div>
        
        <InfoPanel />
      </div>
      
      <StatusBar />
      
      <ReportModal 
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setScreenshotData(undefined);
        }}
        screenshotData={screenshotData}
      />
    </div>
  );
}
