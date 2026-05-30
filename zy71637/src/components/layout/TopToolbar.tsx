import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Play,
  Settings,
  Download,
  AlertTriangle,
  FileJson,
  Database,
  RotateCcw,
  Sun,
  Moon,
  Grid3X3,
  Maximize2,
  Info,
  Tag,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { parseFile } from '../../utils/fileParser';
import { generateDirtyDataForTesting } from '../../utils/mockData';
import { COLORS } from '../../utils/colorMapping';

export function TopToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    setRawSnapshots,
    processingStats,
    anomalyStats,
    isLoading,
    clearData,
  } = useDataStore();

  const {
    toggleShowGrid,
    toggleShowAxes,
    toggleShowLabels,
    toggleAutoRotate,
    setColorScheme,
    colorScheme,
    showToast,
    setShowReportPreview,
    showGrid,
    showAxes,
    showLabels,
    autoRotate,
  } = useUIStore();

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(extension)) {
      showToast('error', `不支持的文件格式，请上传 ${validExtensions.join('、')} 文件`);
      return;
    }

    try {
      showToast('info', `正在解析文件: ${file.name}`);
      const result = await parseFile(file);
      
      if (result.snapshots.length === 0) {
        showToast('error', '未解析到有效数据，请检查文件格式');
        return;
      }

      setRawSnapshots(result.snapshots, result.anomalies);
      
      const message = `成功解析 ${result.snapshots.length} 条快照记录`;
      if (result.warnings.length > 0) {
        showToast('warning', `${message}，有 ${result.warnings.length} 条警告`);
      } else {
        showToast('success', message);
      }
    } catch (error) {
      showToast('error', `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [setRawSnapshots, showToast]);

  const handleGenerateTestData = useCallback(() => {
    showToast('info', '正在生成测试数据（含脏数据）...');
    const result = generateDirtyDataForTesting();
    
    setRawSnapshots(result.snapshots, result.anomalies);
    
    const anomalyTypes = new Set(result.anomalies.map(a => a.type));
    showToast(
      'success',
      `生成 ${result.snapshots.length} 条快照，包含 ${result.anomalies.length} 个异常，覆盖 ${anomalyTypes.size} 种异常类型`
    );
  }, [setRawSnapshots, showToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  return (
    <div className="h-14 bg-[#0f1419]/90 backdrop-blur-md border-b border-[#1a1f2e] flex items-center justify-between px-4 relative z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Grid3X3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">期货盘口深度立方</h1>
            <p className="text-[10px] text-gray-500 -mt-1">Futures Order Book Depth Cube</p>
          </div>
        </div>

        {processingStats && (
          <div className="flex items-center gap-4 ml-4 text-xs">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1a1f2e]">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-gray-300">
                <span className="text-cyan-400 font-mono font-semibold">{processingStats.validSnapshots}</span>
                <span className="text-gray-500"> / {processingStats.totalSnapshots} 快照</span>
              </span>
            </div>
            
            {anomalyStats && anomalyStats.total > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-950/50 border border-red-900/50">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-gray-300">
                  <span className="text-red-400 font-mono font-semibold">{anomalyStats.total}</span>
                  <span className="text-gray-500"> 异常</span>
                </span>
              </div>
            )}

            {processingStats.nullValues > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-950/50 border border-purple-900/50">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-purple-400 font-mono text-xs">{processingStats.nullValues} 空值</span>
              </div>
            )}

            {processingStats.duplicates > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-950/50 border border-orange-900/50">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-orange-400 font-mono text-xs">{processingStats.duplicates} 重复</span>
              </div>
            )}

            {processingStats.misalignments > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-950/50 border border-yellow-900/50">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-yellow-400 font-mono text-xs">{processingStats.misalignments} 错位</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerateTestData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-900/30"
        >
          <FileJson className="w-4 h-4" />
          生成测试数据
        </motion.button>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all
            ${isDragging
              ? 'bg-cyan-500/20 border-2 border-dashed border-cyan-400 text-cyan-400'
              : 'bg-[#1a1f2e] text-gray-300 hover:bg-[#252d3d] border border-transparent'
            }`}
        >
          <Upload className="w-4 h-4" />
          导入数据
        </motion.div>

        <div className="w-px h-6 bg-[#2a3142] mx-2" />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleShowGrid}
          className={`p-2 rounded-lg transition-all ${
            showGrid ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e]'
          }`}
          title="显示网格"
        >
          <Grid3X3 className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleShowAxes}
          className={`p-2 rounded-lg transition-all ${
            showAxes ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e]'
          }`}
          title="显示坐标轴"
        >
          <Maximize2 className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleShowLabels}
          className={`p-2 rounded-lg transition-all ${
            showLabels ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e]'
          }`}
          title="显示标签"
        >
          <Info className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleAutoRotate}
          className={`p-2 rounded-lg transition-all ${
            autoRotate ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e]'
          }`}
          title="自动旋转"
        >
          <RotateCcw className="w-4 h-4" />
        </motion.button>

        <div className="w-px h-6 bg-[#2a3142] mx-2" />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e] transition-all"
          title="切换主题"
        >
          {colorScheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e] transition-all"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowReportPreview(true)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e] transition-all"
          title="导出报告"
        >
          <Download className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={clearData}
          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition-all"
          title="清除数据"
        >
          <RotateCcw className="w-4 h-4" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-cyan-500/10 border-2 border-dashed border-cyan-400 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="text-center">
              <Upload className="w-12 h-12 text-cyan-400 mx-auto mb-2" />
              <p className="text-cyan-400 text-lg font-medium">释放文件以上传</p>
              <p className="text-cyan-400/60 text-sm">支持 .csv, .xlsx, .xls 格式</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
