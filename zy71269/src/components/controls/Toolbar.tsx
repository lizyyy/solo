import { useState, useMemo } from 'react';
import { useView3DStore } from '@/store/useView3DStore';
import { useThermalStore } from '@/store/useThermalStore';
import { 
  Wind, Thermometer, Flame, Download, 
  Filter, Eye, EyeOff, FileSpreadsheet, Image 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const Toolbar = () => {
  const { 
    showAirFlow, showSensors, showHeatMap, 
    toggleAirFlow, toggleSensors, toggleHeatMap 
  } = useView3DStore();
  const chipPackage = useThermalStore((state) => state.chipPackage);
  const filterConditions = useThermalStore((state) => state.filterConditions);
  const setFilter = useThermalStore((state) => state.setFilter);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const powerPoints = useMemo(() => {
    return chipPackage.powerPoints.filter(pp => {
      const tempInRange = pp.temperature >= filterConditions.tempRange[0] && 
                         pp.temperature <= filterConditions.tempRange[1];
      const powerInRange = pp.power >= filterConditions.powerRange[0] && 
                          pp.power <= filterConditions.powerRange[1];
      const isAnomaly = pp.status !== 'normal';
      const anomalyFilter = !filterConditions.showOnlyAnomalies || isAnomaly;
      return tempInRange && powerInRange && anomalyFilter;
    });
  }, [chipPackage.powerPoints, filterConditions]);

  const sensors = useMemo(() => {
    return chipPackage.tempSensors.filter(s => {
      if (s.isMissing) return true;
      const tempInRange = s.temperature >= filterConditions.tempRange[0] && 
                         s.temperature <= filterConditions.tempRange[1];
      const anomalyFilter = !filterConditions.showOnlyAnomalies || s.isMissing;
      return tempInRange && anomalyFilter;
    });
  }, [chipPackage.tempSensors, filterConditions]);

  const stats = useMemo(() => {
    const filteredTemps = [
      ...powerPoints.map(p => p.temperature),
      ...sensors.filter(s => !s.isMissing).map(s => s.temperature)
    ];
    if (filteredTemps.length === 0) {
      return { maxTemp: 0, minTemp: 0, avgTemp: 0, hotspotCount: 0 };
    }
    return {
      maxTemp: Math.max(...filteredTemps),
      minTemp: Math.min(...filteredTemps),
      avgTemp: filteredTemps.reduce((a, b) => a + b, 0) / filteredTemps.length,
      hotspotCount: powerPoints.filter(p => p.status === 'critical').length
    };
  }, [powerPoints, sensors]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const statsData = [
      ['指标', '数值'],
      ['最高温度', `${stats.maxTemp.toFixed(1)}°C`],
      ['最低温度', `${stats.minTemp.toFixed(1)}°C`],
      ['平均温度', `${stats.avgTemp.toFixed(1)}°C`],
      ['热点数量', stats.hotspotCount]
    ];
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsSheet, '统计摘要');

    const ppData = powerPoints.map(pp => ({
      '名称': pp.name,
      '温度(°C)': pp.temperature,
      '功耗(W)': pp.power,
      '状态': pp.status === 'critical' ? '严重' : pp.status === 'warning' ? '警告' : '正常',
      '位置X': pp.position.x,
      '位置Y': pp.position.y,
      '位置Z': pp.position.z
    }));
    const ppSheet = XLSX.utils.json_to_sheet(ppData);
    XLSX.utils.book_append_sheet(wb, ppSheet, '功耗点');

    const sensorData = sensors.map(s => ({
      '名称': s.name,
      '预期位置': s.expectedLocation,
      '温度(°C)': s.isMissing ? '缺失' : s.temperature,
      '状态': s.isMissing ? '缺失' : '正常',
      '上次校准': s.lastCalibration
    }));
    const sensorSheet = XLSX.utils.json_to_sheet(sensorData);
    XLSX.utils.book_append_sheet(wb, sensorSheet, '采样点');

    XLSX.writeFile(wb, `热分析报告_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setShowExportMenu(false);
  };

  const handleExportScreenshot = async () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `热岛视图_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
    setShowExportMenu(false);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl px-2 py-2 border border-slate-700/50 shadow-2xl flex items-center gap-1">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-700/50">
          <button
            onClick={toggleHeatMap}
            className={`p-2 rounded-lg transition-all ${
              showHeatMap 
                ? 'bg-orange-500/20 text-orange-400' 
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title="热岛视图"
          >
            <Flame className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSensors}
            className={`p-2 rounded-lg transition-all ${
              showSensors 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title="温度采样点"
          >
            <Thermometer className="w-4 h-4" />
          </button>
          <button
            onClick={toggleAirFlow}
            className={`p-2 rounded-lg transition-all ${
              showAirFlow 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title="风道气流"
          >
            <Wind className="w-4 h-4" />
          </button>
        </div>

        <div className="relative px-2 border-r border-slate-700/50">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 transition-all"
            title="筛选"
          >
            <Filter className="w-4 h-4" />
          </button>

          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 min-w-64 shadow-2xl">
              <h4 className="text-xs font-medium text-slate-200 mb-3">显示筛选</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded bg-slate-700 border-slate-600 cursor-pointer"
                    checked={filterConditions.showOnlyAnomalies}
                    onChange={(e) => setFilter({ showOnlyAnomalies: e.target.checked })}
                  />
                  只显示异常项
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="relative pl-2">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 transition-all"
            title="导出"
          >
            <Download className="w-4 h-4" />
          </button>

          {showExportMenu && (
            <div className="absolute top-full right-0 mt-2 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 p-2 min-w-40 shadow-2xl">
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-400" />
                导出 Excel 报表
              </button>
              <button
                onClick={handleExportScreenshot}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <Image className="w-4 h-4 text-purple-400" />
                导出截图
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
