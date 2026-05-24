import { useState } from 'react';
import {
  FileJson,
  Layers,
  Building2,
  Ban,
  Route,
  Battery,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  Map
} from 'lucide-react';
import { useAppStore } from '@/store';
import { mockMissions } from '@/data/mockMissions';
import { exportMissionAsJSON } from '@/utils/export';
import { Mission } from '@/types';

export const LeftPanel = () => {
  const {
    currentMission,
    filters,
    setCurrentMission,
    setFilters,
    resetState,
    selectedWaypoint,
    currentMission: mission
  } = useAppStore();

  const [expandedSections, setExpandedSections] = useState({
    mission: true,
    filters: true,
    waypoints: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string) as Mission;
          setCurrentMission(data);
        } catch (err) {
          console.error('Failed to parse mission file:', err);
        }
      };
      reader.readAsText(file);
    }
  };

  const selectedWaypointData = mission?.flightPaths[0]?.waypoints.find(
    wp => wp.id === selectedWaypoint
  );

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Map className="w-6 h-6 text-cyan-400" />
          <h1 className="text-lg font-bold text-white">无人机航线规划</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">飞城区航线训练系统</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('mission')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">任务管理</span>
            </div>
            {expandedSections.mission ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.mission && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-2">选择样例任务</label>
                <select
                  value={currentMission?.id || ''}
                  onChange={(e) => {
                    const mission = mockMissions.find(m => m.id === e.target.value);
                    if (mission) setCurrentMission(mission);
                  }}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- 请选择任务 --</option>
                  {mockMissions.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded transition-colors">
                    <Upload className="w-3 h-3" />
                    导入
                  </div>
                </label>
                {currentMission && (
                  <button
                    onClick={() => exportMissionAsJSON(currentMission)}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    导出
                  </button>
                )}
              </div>

              <button
                onClick={resetState}
                className="w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs py-2 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重置状态
              </button>

              {currentMission && (
                <div className="mt-3 p-3 bg-slate-800 rounded">
                  <p className="text-xs font-medium text-white">{currentMission.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{currentMission.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('filters')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">图层筛选</span>
            </div>
            {expandedSections.filters ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.filters && (
            <div className="px-4 pb-4 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showBuildings}
                  onChange={(e) => setFilters({ showBuildings: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">显示建筑物</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showNoFlyZones}
                  onChange={(e) => setFilters({ showNoFlyZones: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <Ban className="w-4 h-4 text-red-400" />
                <span className="text-sm text-slate-300">显示禁飞区</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showFlightPath}
                  onChange={(e) => setFilters({ showFlightPath: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <Route className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-slate-300">显示航线</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showBatteryCurve}
                  onChange={(e) => setFilters({ showBatteryCurve: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <Battery className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-300">显示电量曲线</span>
              </label>
            </div>
          )}
        </div>

        {currentMission && (
          <div className="border-b border-slate-700">
            <button
              onClick={() => toggleSection('waypoints')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">航点列表</span>
              </div>
              {expandedSections.waypoints ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            
            {expandedSections.waypoints && (
              <div className="px-4 pb-4">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {currentMission.flightPaths[0]?.waypoints.map((wp, index) => (
                    <div
                      key={wp.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        selectedWaypoint === wp.id
                          ? 'bg-cyan-600/30 border border-cyan-500'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white">航点 {index + 1}</span>
                        <span className="text-xs text-slate-400">
                          {wp.position.unit === 'meter' ? '米' : '英尺'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        X: {wp.position.x.toFixed(1)} | Y: {wp.position.y.toFixed(1)} | Z: {wp.position.z.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedWaypointData && (
          <div className="p-4 bg-slate-800/50">
            <h3 className="text-sm font-medium text-white mb-2">选中航点详情</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">高度单位</span>
                <span className="text-cyan-400">
                  {selectedWaypointData.position.unit === 'meter' ? '米 (m)' : '英尺 (ft)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">飞行速度</span>
                <span className="text-white">{selectedWaypointData.speed} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">停留时间</span>
                <span className="text-white">{selectedWaypointData.stayTime}s</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
