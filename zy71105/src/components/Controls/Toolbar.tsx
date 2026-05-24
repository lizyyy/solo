import { useRef, useState } from 'react';
import {
  Upload,
  Download,
  FileText,
  RotateCcw,
  Eye,
  Save,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { exportReport, exportSceneJSON, printReport } from '../../services/exportReport';
import { SceneData } from '../../types';

export default function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const {
    loadSampleData,
    resetScene,
    exportScene,
    importScene,
    cameraView,
    setCameraView,
    isPlaying,
    setIsPlaying,
    collisionWarnings,
    toggleLeftPanel,
    toggleRightPanel,
    leftPanelOpen,
    rightPanelOpen
  } = useSceneStore();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string) as SceneData;
          importScene(data);
        } catch (err) {
          console.error('Failed to import scene:', err);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportReport = () => {
    const sceneData = exportScene();
    exportReport(sceneData, collisionWarnings);
    setShowExportMenu(false);
  };

  const handlePrintReport = () => {
    const sceneData = exportScene();
    printReport(sceneData, collisionWarnings);
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    const sceneData = exportScene();
    exportSceneJSON(sceneData);
    setShowExportMenu(false);
  };

  const handleSetView = (view: 'front' | 'top' | 'side' | 'free') => {
    setCameraView(view);
    setShowViewMenu(false);
  };

  const viewLabels: Record<string, string> = {
    front: '正面视角',
    top: '俯视视角',
    side: '侧视视角',
    free: '自由视角'
  };

  return (
    <div className="h-12 bg-stage-gray border-b border-white/5 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <h1 className="text-white font-semibold text-sm mr-4">舞台灯光束预演系统</h1>
        
        <button
          className="toolbar-btn"
          onClick={loadSampleData}
          title="导入样例"
        >
          <Upload size={16} />
          <span>导入样例</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="导入场景"
        >
          <Upload size={16} />
          <span>导入场景</span>
        </button>

        <div className="relative">
          <button
            className="toolbar-btn"
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="导出"
          >
            <Download size={16} />
            <span>导出</span>
          </button>
          
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1 bg-stage-gray border border-white/10 rounded-md shadow-xl z-50 min-w-[160px]">
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-stage-gray-light hover:text-white"
                onClick={handleExportJSON}
              >
                <div className="flex items-center gap-2">
                  <Save size={14} />
                  场景文件 (.json)
                </div>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-stage-gray-light hover:text-white"
                onClick={handleExportReport}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} />
                  预演报告 (.html)
                </div>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-stage-gray-light hover:text-white"
                onClick={handlePrintReport}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} />
                  打印报告
                </div>
              </button>
            </div>
          )}
        </div>

        <button
          className="toolbar-btn"
          onClick={resetScene}
          title="重置场景"
        >
          <RotateCcw size={16} />
          <span>重置</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="toolbar-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <div className="relative">
          <button
            className="toolbar-btn"
            onClick={() => setShowViewMenu(!showViewMenu)}
            title="视角"
          >
            <Eye size={16} />
            <span>{viewLabels[cameraView]}</span>
          </button>
          
          {showViewMenu && (
            <div className="absolute top-full right-0 mt-1 bg-stage-gray border border-white/10 rounded-md shadow-xl z-50 min-w-[120px]">
              {(['front', 'top', 'side', 'free'] as const).map((view) => (
                <button
                  key={view}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    cameraView === view
                      ? 'text-stage-blue bg-stage-blue/10'
                      : 'text-gray-300 hover:bg-stage-gray-light hover:text-white'
                  }`}
                  onClick={() => handleSetView(view)}
                >
                  {viewLabels[view]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-white/10 mx-2" />

        <button
          className="toolbar-btn"
          onClick={toggleLeftPanel}
          title={leftPanelOpen ? '隐藏左侧面板' : '显示左侧面板'}
        >
          {leftPanelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <button
          className="toolbar-btn"
          onClick={toggleRightPanel}
          title={rightPanelOpen ? '隐藏右侧面板' : '显示右侧面板'}
        >
          {rightPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  );
}
