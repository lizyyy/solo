import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneStore } from '../../store/useSceneStore';
import { sampleScenes } from '../../data/sampleScenes';
import { exportPDFReport, exportJSONReport } from '../../utils/exportReport';

interface TopToolbarProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const TopToolbar = ({ canvasRef }: TopToolbarProps) => {
  const [showSceneMenu, setShowSceneMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const { 
    resetScene, 
    loadSampleScene, 
    setLeftPanelOpen,
    setRightPanelOpen,
    leftPanelOpen,
    rightPanelOpen,
  } = useSceneStore();

  const handleExportPDF = () => {
    exportPDFReport(useSceneStore.getState(), canvasRef.current);
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportJSONReport(useSceneStore.getState());
    setShowExportMenu(false);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20 h-14 glass-panel flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white hidden sm:block">塔吊吊装预演系统</h1>
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowSceneMenu(!showSceneMenu); setShowExportMenu(false); }}
            className="px-3 py-1.5 bg-dark-300 hover:bg-dark-400 text-white text-sm rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">导入样例</span>
          </button>
          
          <AnimatePresence>
            {showSceneMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 mt-2 w-64 glass-panel rounded-lg overflow-hidden z-50"
              >
                {sampleScenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    onClick={() => {
                      loadSampleScene(scene.sceneData);
                      setShowSceneMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-dark-300 transition-colors border-b border-dark-300 last:border-0"
                  >
                    <div className="text-white font-medium text-sm">{index + 1}. {scene.name}</div>
                    <div className="text-gray-400 text-xs mt-1">{scene.description}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={resetScene}
          className="px-3 py-1.5 bg-dark-300 hover:bg-dark-400 text-white text-sm rounded transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">重置</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className={`p-2 rounded transition-colors ${leftPanelOpen ? 'bg-primary text-white' : 'bg-dark-300 text-gray-400 hover:bg-dark-400'}`}
          title="切换参数面板"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className={`p-2 rounded transition-colors ${rightPanelOpen ? 'bg-primary text-white' : 'bg-dark-300 text-gray-400 hover:bg-dark-400'}`}
          title="切换风险面板"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </button>

        <div className="relative">
          <button
            onClick={() => { setShowExportMenu(!showExportMenu); setShowSceneMenu(false); }}
            className="px-4 py-1.5 bg-primary hover:bg-primary/80 text-white text-sm rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">导出报告</span>
          </button>
          
          <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full right-0 mt-2 w-48 glass-panel rounded-lg overflow-hidden z-50"
              >
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-3 text-left hover:bg-dark-300 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-danger/20 rounded flex items-center justify-center">
                    <span className="text-danger text-xs font-bold">PDF</span>
                  </div>
                  <span className="text-white text-sm">导出 PDF 报告</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-3 text-left hover:bg-dark-300 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                    <span className="text-primary text-xs font-bold">JSON</span>
                  </div>
                  <span className="text-white text-sm">导出 JSON 数据</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TopToolbar;
