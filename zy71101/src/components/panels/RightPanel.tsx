import { useState, useMemo } from 'react';
import {
  Battery,
  AlertTriangle,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  MapPin,
  Zap
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAppStore } from '@/store';
import { generateReport, captureScreenshot } from '@/utils/export';
import { getBatteryStatus, estimateBatteryAtTime } from '@/utils/battery';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const RightPanel = () => {
  const {
    currentMission,
    currentTime,
    alerts,
    cameraState,
    filters,
    isPlaying
  } = useAppStore();

  const [expandedSections, setExpandedSections] = useState({
    battery: true,
    alerts: true,
    stats: true,
    export: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const currentBattery = useMemo(() => {
    if (!currentMission) return 100;
    return estimateBatteryAtTime(currentMission.batteryCurve, currentTime);
  }, [currentMission, currentTime]);

  const batteryStatus = getBatteryStatus(currentBattery, 20);

  const batteryChartData = useMemo(() => {
    if (!currentMission) return null;
    
    return {
      labels: currentMission.batteryCurve.map(p => `${p.time.toFixed(0)}s`),
      datasets: [
        {
          label: '电量 (%)',
          data: currentMission.batteryCurve.map(p => p.percentage),
          borderColor: '#06B6D4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: '返航电量线',
          data: currentMission.batteryCurve.map(() => 25),
          borderColor: '#F59E0B',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: '危险电量线',
          data: currentMission.batteryCurve.map(() => 15),
          borderColor: '#EF4444',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    };
  }, [currentMission]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#CBD5E1',
        borderColor: '#334155',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 10
          }
        }
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 10
          },
          callback: (value: any) => `${value}%`
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  const handleExportReport = async () => {
    if (!currentMission) return;
    
    const screenshot = await captureScreenshot('scene-canvas');
    const cameraPos = `(${cameraState.position.map(p => p.toFixed(1)).join(', ')})`;
    
    await generateReport({
      mission: currentMission,
      appState: {
        currentTime,
        cameraView: 'orbit',
        filters,
        alerts
      },
      cameraPosition: cameraPos,
      screenshot: screenshot || undefined
    });
  };

  const totalDistance = currentMission?.batteryCurve[currentMission.batteryCurve.length - 1]?.distance || 0;

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm font-medium text-white">
              {isPlaying ? '回放中' : '已暂停'}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {currentTime.toFixed(1)}s
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('battery')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Battery className={`w-4 h-4 ${
                batteryStatus.status === 'danger' ? 'text-red-400' :
                batteryStatus.status === 'warning' ? 'text-yellow-400' : 'text-green-400'
              }`} />
              <span className="text-sm font-medium text-white">电量状态</span>
            </div>
            {expandedSections.battery ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.battery && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${
                    batteryStatus.status === 'danger' ? 'text-red-400' :
                    batteryStatus.status === 'warning' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {currentBattery.toFixed(0)}%
                  </span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  batteryStatus.status === 'danger' ? 'bg-red-600/20 text-red-400' :
                  batteryStatus.status === 'warning' ? 'bg-yellow-600/20 text-yellow-400' :
                  'bg-green-600/20 text-green-400'
                }`}>
                  {batteryStatus.status === 'danger' ? '危险' :
                   batteryStatus.status === 'warning' ? '警告' : '正常'}
                </span>
              </div>
              
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    batteryStatus.status === 'danger' ? 'bg-red-500' :
                    batteryStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${currentBattery}%` }}
                />
              </div>
              
              <p className="text-xs text-slate-400 mb-3">{batteryStatus.message}</p>
              
              {batteryChartData && filters.showBatteryCurve && (
                <div className="h-32">
                  <Line data={batteryChartData} options={chartOptions} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('alerts')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${alerts.length > 0 ? 'text-red-400' : 'text-slate-400'}`} />
              <span className="text-sm font-medium text-white">告警信息</span>
              {alerts.length > 0 && (
                <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
            {expandedSections.alerts ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.alerts && (
            <div className="px-4 pb-4">
              {alerts.length === 0 ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-600/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm text-slate-400">暂无告警</p>
                  <p className="text-xs text-slate-500 mt-1">航线安全，可以执行</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-2 rounded ${
                        alert.severity === 'danger'
                          ? 'bg-red-600/20 border border-red-600/50'
                          : 'bg-yellow-600/20 border border-yellow-600/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {alert.severity === 'danger' ? (
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-xs text-white">{alert.message}</p>
                          {alert.time !== undefined && (
                            <p className="text-xs text-slate-400 mt-1">
                              时间: {alert.time.toFixed(1)}s
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('stats')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">任务统计</span>
            </div>
            {expandedSections.stats ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.stats && currentMission && (
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-800 rounded">
                  <p className="text-xs text-slate-400">总航点数</p>
                  <p className="text-lg font-bold text-white">
                    {currentMission.flightPaths.reduce((acc, fp) => acc + fp.waypoints.length, 0)}
                  </p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <p className="text-xs text-slate-400">总飞行距离</p>
                  <p className="text-lg font-bold text-white">{totalDistance.toFixed(0)}m</p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <p className="text-xs text-slate-400">禁飞区数量</p>
                  <p className="text-lg font-bold text-white">{currentMission.noFlyZones.length}</p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <p className="text-xs text-slate-400">建筑物数量</p>
                  <p className="text-lg font-bold text-white">{currentMission.buildings.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('export')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">报告导出</span>
            </div>
            {expandedSections.export ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.export && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-400 mb-2">
                  导出的报告将包含当前视角、筛选条件、时间轴位置和所有相关数据。
                </p>
                <button
                  onClick={handleExportReport}
                  disabled={!currentMission}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm py-2 rounded transition-colors"
                >
                  <Download className="w-4 h-4" />
                  导出规划报告 (PDF)
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <h3 className="text-xs font-medium text-slate-400 mb-2">相机位置</h3>
          <div className="p-2 bg-slate-800 rounded font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Pos:</span>
              <span className="text-cyan-400">
                {cameraState.position.map(p => p.toFixed(1)).join(', ')}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Tgt:</span>
              <span className="text-slate-300">
                {cameraState.target.map(p => p.toFixed(1)).join(', ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
