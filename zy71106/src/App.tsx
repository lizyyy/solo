import { useState, useCallback } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { LeftPanel } from './components/layout/LeftPanel';
import { RightPanel } from './components/layout/RightPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SceneCanvas } from './components/scene/SceneCanvas';
import { exportPDFReport, downloadBlob } from './utils/reportGenerator';
import { ViewPreset } from './types';

function App() {
  const [captureScreenshot, setCaptureScreenshot] = useState<(() => string | null) | null>(null);
  const [setViewPreset, setSetViewPreset] = useState<((preset: ViewPreset) => void) | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const handleCapture = useCallback((fn: () => string | null) => {
    setCaptureScreenshot(() => fn);
  }, []);

  const handleSetViewPreset = useCallback((fn: (preset: ViewPreset) => void) => {
    setSetViewPreset(() => fn);
  }, []);

  const handleExportReport = async () => {
    if (!captureScreenshot) return;

    setIsExporting(true);
    try {
      const sceneImage = captureScreenshot();
      const blob = await exportPDFReport(sceneImage, (msg) => {
        setExportMessage(msg);
      });
      const filename = `光伏阴影分析报告_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, filename);
      setExportMessage('报告已下载！');
      setTimeout(() => {
        setIsExporting(false);
        setExportMessage('');
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportMessage('导出失败，请重试');
      setTimeout(() => {
        setIsExporting(false);
        setExportMessage('');
      }, 3000);
    }
  };

  const handleViewPreset = (preset: ViewPreset) => {
    if (setViewPreset) {
      setViewPreset(preset);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <Toolbar
        onExportReport={handleExportReport}
        onSetViewPreset={handleViewPreset}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />

        <div className="flex-1 relative">
          <SceneCanvas
            onCapture={handleCapture}
            onSetViewPreset={handleSetViewPreset}
          />

          {isExporting && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-white">{exportMessage || '正在导出...'}</p>
              </div>
            </div>
          )}
        </div>

        <RightPanel />
      </div>

      <StatusBar />
    </div>
  );
}

export default App;
