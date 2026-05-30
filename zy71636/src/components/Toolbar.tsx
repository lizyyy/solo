import { useState, useRef } from 'react';
import {
  Camera,
  Download,
  History,
  Layers,
  Box,
  Grid3X3,
  RefreshCw,
  FileText,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

interface ToolbarProps {
  onExport: () => void;
  onGoToHistory: () => void;
}

export function Toolbar({ onExport, onGoToHistory }: ToolbarProps) {
  const viewMode = useAppStore((state) => state.view.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const visibleLayers = useAppStore((state) => state.view.visibleLayers);
  const toggleLayer = useAppStore((state) => state.toggleLayer);
  const filters = useAppStore((state) => state.filters);
  const cracks = useAppStore((state) => state.cracks);
  const sensors = useAppStore((state) => state.sensors);
  const historyRecords = useAppStore((state) => state.historyRecords);

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportTitle, setExportTitle] = useState('水坝巡检报告');
  const [exportDescription, setExportDescription] = useState('');
  const [includeFilters, setIncludeFilters] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const layerMenuRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      onExport();
      setExporting(false);
      setShowExportDialog(false);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    }, 1500);
  };

  const boundaryIssueCount = cracks.filter((c) => c.hasBoundaryIssue).length +
    sensors.filter((s) => s.hasBreakpoint).length;

  const pendingConfirmCount = historyRecords.filter((r) => !r.manualConfirmed).length;

  return (
    <div className="h-12 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <Grid3X3 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">水坝3D巡检系统</h1>
            <p className="text-xs text-slate-500">Dam Inspection 3D Viewer</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700 mx-2" />

        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('perspective')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              viewMode === 'perspective'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
            title="透视视图"
          >
            <Box size={14} />
            透视
          </button>
          <button
            onClick={() => setViewMode('orthographic')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              viewMode === 'orthographic'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
            title="正交视图"
          >
            <Grid3X3 size={14} />
            正交
          </button>
        </div>

        <div className="relative" ref={layerMenuRef}>
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            <Layers size={14} />
            图层
          </button>
          {showLayerMenu && (
            <div className="absolute top-full left-0 mt-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 min-w-40 z-50">
              {[
                { key: 'dam', label: '坝体模型' },
                { key: 'cracks', label: '裂缝标注' },
                { key: 'sensors', label: '传感器' },
                { key: 'stress', label: '应力云图' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key as any)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <span>{label}</span>
                  {visibleLayers[key as keyof typeof visibleLayers] && (
                    <Check size={14} className="text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onGoToHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors relative"
        >
          <History size={14} />
          历史追溯
          {pendingConfirmCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              {pendingConfirmCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {boundaryIssueCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle size={14} className="text-yellow-400" />
            <span className="text-xs text-yellow-400">
              {boundaryIssueCount} 条边界问题待处理
            </span>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
        >
          <RefreshCw size={14} />
          刷新
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-400 rounded-lg text-xs font-medium text-white transition-colors"
        >
          <Camera size={14} />
          截图导出
        </button>

        {showExportSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg animate-pulse">
            <Check size={14} className="text-green-400" />
            <span className="text-xs text-green-400">导出成功</span>
          </div>
        )}
      </div>

      {showExportDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-96 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Download size={18} />
                导出3D截图报告
              </h3>
              <button
                onClick={() => setShowExportDialog(false)}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">报告标题</label>
                <input
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">报告说明</label>
                <textarea
                  value={exportDescription}
                  onChange={(e) => setExportDescription(e.target.value)}
                  placeholder="添加导出说明..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFilters}
                    onChange={(e) => setIncludeFilters(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">包含当前筛选条件</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnnotations}
                    onChange={(e) => setIncludeAnnotations(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">包含对象标注和图例</span>
                </label>
              </div>

              {includeFilters && (
                <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
                  <p className="font-medium text-slate-300 mb-2">导出时将包含以下筛选条件：</p>
                  <div className="grid grid-cols-2 gap-1">
                    <span>数据类型: {filters.dataTypes.join(', ')}</span>
                    <span>异常等级: {filters.severityLevel.join(', ')}</span>
                    <span>传感器状态: {filters.sensorStatus.join(', ')}</span>
                    <span>边界问题: {filters.showBoundaryIssues ? '显示' : '隐藏'}</span>
                  </div>
                </div>
              )}

              <div className="bg-slate-700/30 rounded-lg p-3 text-xs text-slate-500">
                <FileText size={12} className="inline mr-1" />
                导出图片将包含3D坝体视图、裂缝标注、传感器点位、应力云图以及所有筛选条件说明，便于他人直接查看理解。
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 flex gap-2">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    确认导出
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
