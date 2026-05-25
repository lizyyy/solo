import { useState, useMemo } from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, BarChart3, X, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatTime, formatDuration, getOrientationName } from '../../types';
import { calculateTotalShadowDuration, groupShadowsByBuilding } from '../../utils/shadowDetection';

export default function RightStatsPanel() {
  const { 
    rightPanelOpen, 
    shadowRecords, 
    selectedWindows, 
    windows,
    buildings,
    currentTime,
    clearSelectedWindows,
    isDataLoaded,
    deselectWindow,
  } = useAppStore();

  const [statsExpanded, setStatsExpanded] = useState(true);
  const [windowsExpanded, setWindowsExpanded] = useState(true);
  const [filterOrientation, setFilterOrientation] = useState<string>('all');

  const selectedWindowData = useMemo(() => {
    return windows.filter(w => selectedWindows.includes(w.id));
  }, [windows, selectedWindows]);

  const shadowStats = useMemo(() => {
    const groups = groupShadowsByBuilding(shadowRecords);
    const stats: { name: string; duration: number; buildingId: string }[] = [];
    
    groups.forEach((records, buildingId) => {
      const building = buildings.find(b => b.id === buildingId);
      stats.push({
        name: building?.name || buildingId,
        duration: calculateTotalShadowDuration(records),
        buildingId,
      });
    });

    return stats.sort((a, b) => b.duration - a.duration);
  }, [shadowRecords, buildings]);

  const totalShadowDuration = useMemo(() => {
    return calculateTotalShadowDuration(shadowRecords);
  }, [shadowRecords]);

  const totalDaylightMinutes = 720;
  const sunlightDuration = Math.max(0, totalDaylightMinutes - totalShadowDuration);

  const chartData = [
    { name: '日照', value: sunlightDuration, color: '#f59e0b' },
    { name: '遮挡', value: totalShadowDuration, color: '#ef4444' },
  ];

  const filteredWindows = useMemo(() => {
    if (filterOrientation === 'all') return selectedWindowData;
    return selectedWindowData.filter(w => w.orientation === filterOrientation);
  }, [selectedWindowData, filterOrientation]);

  const currentShadowRecords = useMemo(() => {
    return shadowRecords.filter(
      r => currentTime >= r.startTime && currentTime <= r.endTime
    );
  }, [shadowRecords, currentTime]);

  if (!rightPanelOpen || !isDataLoaded) return null;

  return (
    <div className="fixed right-2 sm:right-4 top-16 sm:top-20 bottom-2 sm:bottom-4 w-64 sm:w-72 lg:w-80 z-40 flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-1rem)]">
      <div className="glass-panel rounded-xl p-4 pointer-events-auto overflow-y-auto max-h-full">
        <div className="mb-4">
          <button
            onClick={() => setStatsExpanded(!statsExpanded)}
            className="w-full flex items-center justify-between text-white font-medium text-sm"
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-sun-500" />
              遮挡统计
            </div>
            {statsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {statsExpanded && (
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-sun-500/20 rounded-lg p-3">
                <p className="text-sun-400 text-xs">日照时长</p>
                <p className="text-white font-mono text-lg">{formatDuration(sunlightDuration)}</p>
              </div>
              <div className="bg-shadow-500/20 rounded-lg p-3">
                <p className="text-shadow-400 text-xs">遮挡时长</p>
                <p className="text-white font-mono text-lg">{formatDuration(totalShadowDuration)}</p>
              </div>
            </div>

            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={40} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                    formatter={(value: number) => formatDuration(value)}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>

            {shadowStats.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                  <Building2 size={12} />
                  遮挡来源
                </p>
                <div className="space-y-2">
                  {shadowStats.map((stat) => (
                    <div key={stat.buildingId} className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full bg-shadow-500"
                      />
                      <span className="text-white text-xs flex-1 truncate">{stat.name}</span>
                      <span className="text-gray-400 text-xs font-mono">
                        {formatDuration(stat.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentShadowRecords.length > 0 && (
              <div className="bg-shadow-500/10 rounded-lg p-3 border border-shadow-500/30">
                <p className="text-shadow-400 text-xs font-medium mb-1">
                  ⚠️ 当前时段遮挡中
                </p>
                <p className="text-white text-xs">
                  来自：{currentShadowRecords[0].buildingName}
                </p>
                <p className="text-gray-400 text-xs">
                  {formatTime(currentShadowRecords[0].startTime)} - {formatTime(currentShadowRecords[0].endTime)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/10 my-4" />

        <div className="mb-4">
          <button
            onClick={() => setWindowsExpanded(!windowsExpanded)}
            className="w-full flex items-center justify-between text-white font-medium text-sm"
          >
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-sun-500" />
                已选窗户 ({selectedWindows.length})
              </div>
              {selectedWindows.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelectedWindows();
                  }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  清空
                </button>
              )}
            </div>
            {windowsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {windowsExpanded && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {['all', 'south', 'north', 'east', 'west'].map((orient) => (
                <button
                  key={orient}
                  onClick={() => setFilterOrientation(orient)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    filterOrientation === orient
                      ? 'bg-sun-500 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {orient === 'all' ? '全部' : getOrientationName(orient as 'south' | 'north' | 'east' | 'west')}
                </button>
              ))}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredWindows.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">
                  点击3D场景中的窗户进行选择
                </p>
              ) : (
                filteredWindows.map((window) => {
                  const building = buildings.find(b => b.id === window.buildingId);
                  const windowShadows = shadowRecords.filter(r => r.windowId === window.id);
                  const windowShadowDuration = calculateTotalShadowDuration(windowShadows);
                  
                  return (
                    <div
                      key={window.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">
                          {building?.name} {window.unitNumber}室
                        </p>
                        <p className="text-gray-400 text-xs">
                          {window.floor}层 · {getOrientationName(window.orientation)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-mono ${windowShadowDuration > 0 ? 'text-shadow-400' : 'text-sun-400'}`}>
                          {windowShadowDuration > 0 ? `-${formatDuration(windowShadowDuration)}` : '无遮挡'}
                        </p>
                      </div>
                      <button
                        onClick={() => deselectWindow(window.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <X size={12} className="text-gray-400" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
