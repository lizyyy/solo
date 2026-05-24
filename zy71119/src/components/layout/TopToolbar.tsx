import { useState } from 'react';
import { 
  Upload, 
  RotateCcw, 
  Download, 
  Eye, 
  Sun, 
  Play, 
  Pause,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FileText,
  Image,
  FileSpreadsheet
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { VIEW_PRESETS, formatTime } from '../../types';
import { exportToPDF, exportToCSV, captureScreenshot } from '../../utils/export';
export default function TopToolbar() {
  const {
    isDataLoaded,
    loadSampleData,
    resetState,
    currentTime,
    isPlaying,
    togglePlay,
    setCameraPosition,
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
    currentDate,
    shadowRecords,
    selectedWindows,
    buildings,
  } = useAppStore();
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleViewPreset = (preset: typeof VIEW_PRESETS[0]) => {
    setCameraPosition(preset.position, preset.target);
    setShowViewMenu(false);
  };

  const handleExportPDF = () => {
    exportToPDF(currentDate, shadowRecords, selectedWindows, buildings);
    setShowExportMenu(false);
  };

  const handleExportScreenshot = async () => {
    const dataUrl = await captureScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `日照场景截图_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    }
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    exportToCSV(shadowRecords, buildings);
    setShowExportMenu(false);
  };
 return (<div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3">
 <div className="flex items-center gap-2">
 <button onClick={toggleLeftPanel} className="p-2 rounded-lg glass-panel hover:bg-white/10 transition-colors">
 {leftPanelOpen ? <ChevronLeft size={20} className="text-white"/> : <Menu size={20} className="text-white"/>}
 </button>
 
 <div className="glass-panel rounded-lg px-4 py-2">
 <h1 className="text-white font-semibold text-sm flex items-center gap-2">
 <Sun size={18} className="text-sun-500"/>
 公寓日照投诉复盘
 </h1>
 </div>

 {!isDataLoaded && (<button onClick={loadSampleData} className="flex items-center gap-2 px-4 py-2 bg-sun-500 hover:bg-sun-600 text-white rounded-lg transition-colors font-medium text-sm">
 <Upload size={16}/>
 导入样例数据
 </button>)}
 </div>

 <div className="flex items-center gap-2">
 {isDataLoaded && (<div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-3">
 <button onClick={togglePlay} className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors">
 {isPlaying ? (<Pause size={16} className="text-white"/>) : (<Play size={16} className="text-white"/>)}
 </button>
 <span className="text-white font-mono text-sm min-w-[60px] text-center">
 {formatTime(currentTime)}
 </span>
 </div>)}

 <div className="relative">
 <button onClick={() => {
 setShowViewMenu(!showViewMenu);
 setShowExportMenu(false);
 }} className="flex items-center gap-2 p-2 rounded-lg glass-panel hover:bg-white/10 transition-colors">
 <Eye size={18} className="text-white"/>
 <span className="text-white text-sm hidden sm:inline">视角</span>
 </button>
 
 {showViewMenu && (<div className="absolute top-full right-0 mt-2 glass-panel rounded-lg py-2 min-w-[120px] z-50">
 {VIEW_PRESETS.map((preset) => (<button key={preset.name} onClick={() => handleViewPreset(preset)} className="w-full px-4 py-2 text-left text-white text-sm hover:bg-white/10 transition-colors">
 {preset.name}
 </button>))}
 </div>)}
 </div>

 <button onClick={resetState} className="p-2 rounded-lg glass-panel hover:bg-white/10 transition-colors" title="重置状态">
 <RotateCcw size={18} className="text-white"/>
 </button>

 <div className="relative">
 <button onClick={() => {
 setShowExportMenu(!showExportMenu);
 setShowViewMenu(false);
 }} className="flex items-center gap-2 p-2 rounded-lg glass-panel hover:bg-white/10 transition-colors">
 <Download size={18} className="text-white"/>
 <span className="text-white text-sm hidden sm:inline">导出</span>
 </button>
 
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 glass-panel rounded-lg py-2 min-w-[180px] z-50">
                    <button
                      onClick={handleExportPDF}
                      className="w-full px-4 py-2 text-left text-white text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <FileText size={16} />
                      导出PDF报告
                    </button>
                    <button
                      onClick={handleExportScreenshot}
                      className="w-full px-4 py-2 text-left text-white text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <Image size={16} />
                      导出当前截图
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="w-full px-4 py-2 text-left text-white text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <FileSpreadsheet size={16} />
                      导出CSV数据
                    </button>
                  </div>
                )}
 </div>

 <button onClick={toggleRightPanel} className="p-2 rounded-lg glass-panel hover:bg-white/10 transition-colors lg:hidden">
 {rightPanelOpen ? <ChevronRight size={20} className="text-white"/> : <X size={20} className="text-white"/>}
 </button>
 </div>
 </div>);
}

