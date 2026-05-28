import { 
  Thermometer, 
  Route, 
  Download, 
  FileText, 
  Camera,
  AlertTriangle,
  Box,
  MapPin,
  RefreshCw,
  ListChecks
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useState } from 'react';

interface ToolbarProps {
  onExportScreenshot: () => void;
  onExportReport: () => void;
  onOpenTaskPanel: () => void;
}

export default function Toolbar({ onExportScreenshot, onExportReport, onOpenTaskPanel }: ToolbarProps) {
  const { 
    showHeatmap, 
    showRoutes, 
    toggleHeatmap, 
    toggleRoutes,
    locations,
    tasks,
    detectTemperatureAlerts,
    detectHumidityAlerts,
    detectDuplicateLocations
  } = useStore();

  const tempAlerts = detectTemperatureAlerts();
  const humidAlerts = detectHumidityAlerts();
  const duplicates = detectDuplicateLocations();
  const totalAlerts = tempAlerts.length + humidAlerts.length + duplicates.length;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 flex items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50">
          <MapPin size={18} className="text-blue-400" />
          <div>
            <div className="text-white font-semibold text-sm">东方艺术中心典藏库</div>
            <div className="text-slate-400 text-xs">库位总数: {locations.length}</div>
          </div>
        </div>

        {totalAlerts > 0 && (
          <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50">
            <div className="relative">
              <AlertTriangle size={18} className="text-amber-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {totalAlerts}
              </span>
            </div>
            <div className="text-xs">
              <div className="text-red-400">温湿度告警: {tempAlerts.length + humidAlerts.length}</div>
              <div className="text-amber-400">库位异常: {duplicates.length}</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={toggleHeatmap}
            className={`p-2.5 rounded-lg transition-all flex items-center gap-2 ${
              showHeatmap 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
            title="温湿度热力图"
          >
            <Thermometer size={18} />
            <span className="text-sm hidden sm:inline">热力图</span>
          </button>

          <button
            onClick={toggleRoutes}
            className={`p-2.5 rounded-lg transition-all flex items-center gap-2 ${
              showRoutes 
                ? 'bg-green-600 text-white shadow-lg shadow-green-500/30' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
            title="显示出入库路线"
          >
            <Route size={18} />
            <span className="text-sm hidden sm:inline">路线</span>
          </button>
        </div>

        <div className="w-px h-8 bg-slate-700/50" />

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenTaskPanel}
            className="p-2.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2 relative"
            title="任务与操作管理"
          >
            <ListChecks size={18} />
            <span className="text-sm hidden sm:inline">任务</span>
            {tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length}
              </span>
            )}
          </button>

          <button
            onClick={onExportScreenshot}
            className="p-2.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2"
            title="导出截图"
          >
            <Camera size={18} />
            <span className="text-sm hidden sm:inline">截图</span>
          </button>

          <button
            onClick={onExportReport}
            className="p-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/30"
            title="导出仓储报告"
          >
            <FileText size={18} />
            <span className="text-sm hidden sm:inline">报告</span>
          </button>
        </div>
      </div>
    </div>
  );
}
