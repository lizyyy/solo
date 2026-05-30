import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { generateDiagnosticReport, getIssueTypeLabel, getIssueTypeColor, getSourceLabel } from '../diagnostics/detectors';
import { X, Download, RotateCcw, Trophy, Clock, Gauge, AlertTriangle, Zap, ArrowDown, Wind } from 'lucide-react';
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

export const ResultsModal = () => {
  const { currentLap, showResults, closeResults, resetToIdle, lapHistory } = useGameStore();
  const [activeTab, setActiveTab] = useState<'summary' | 'physics' | 'issues' | 'data'>('summary');

  if (!showResults || !currentLap) return null;

  const formatTime = (time: number) => {
    if (!time || time === 0) return '--:--.--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleExport = () => {
    const exportData = {
      lapId: currentLap.id,
      exportTime: new Date().toISOString(),
      totalTime: currentLap.totalTime,
      sectorTimes: currentLap.sectorTimes,
      maxSpeed: currentLap.maxSpeed,
      avgSpeed: currentLap.avgSpeed,
      carParams: currentLap.carParams,
      wingConfig: currentLap.wingConfig,
      windConfig: currentLap.windConfig,
      issues: currentLap.issues,
      frameDataSummary: currentLap.frameData.map(f => ({
        t: f.timestamp.toFixed(2),
        v: f.physics.speed.toFixed(2),
        Fd: f.physics.dragForce.toFixed(0),
        Fdf: f.physics.downForce.toFixed(0),
        mu: f.physics.grip.toFixed(3),
        pos: f.trackProgress.toFixed(3),
        src: f.sourceTag
      })),
      diagnosticReport: generateDiagnosticReport(currentLap.issues)
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lap_${currentLap.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: currentLap.frameData
      .filter((_, i) => i % 5 === 0)
      .map(f => f.timestamp.toFixed(1)),
    datasets: [
      {
        label: '速度 (km/h)',
        data: currentLap.frameData
          .filter((_, i) => i % 5 === 0)
          .map(f => f.physics.speed * 3.6),
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: '阻力 (kN)',
        data: currentLap.frameData
          .filter((_, i) => i % 5 === 0)
          .map(f => f.physics.dragForce / 1000),
        borderColor: '#ff6b35',
        backgroundColor: 'transparent',
        tension: 0.4,
        yAxisID: 'y1'
      },
      {
        label: '下压力 (kN)',
        data: currentLap.frameData
          .filter((_, i) => i % 5 === 0)
          .map(f => f.physics.downForce / 1000),
        borderColor: '#4ade80',
        backgroundColor: 'transparent',
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: '时间 (s)', color: '#64748b', font: { size: 11 } }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: '速度 (km/h)', color: '#00d4ff', font: { size: 11 } }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: '力 (kN)', color: '#ff6b35', font: { size: 11 } }
      }
    }
  };

  const gripChartData = {
    labels: currentLap.frameData
      .filter((_, i) => i % 5 === 0)
      .map(f => f.timestamp.toFixed(1)),
    datasets: [
      {
        label: '抓地力 μ',
        data: currentLap.frameData
          .filter((_, i) => i % 5 === 0)
          .map(f => f.physics.grip),
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: '阈值 0.65',
        data: currentLap.frameData
          .filter((_, i) => i % 5 === 0)
          .map(() => 0.65),
        borderColor: '#ff4757',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      }
    ]
  };

  const gripChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        min: 0,
        max: 1.5,
        title: { display: true, text: '抓地力 μ', color: '#4ade80', font: { size: 11 } }
      }
    }
  };

  const bestLap = lapHistory.reduce((best, lap) => 
    lap.status === 'completed' && lap.totalTime < best.totalTime ? lap : best
  , lapHistory.find(l => l.status === 'completed') || currentLap);

  const isBestLap = currentLap.id === bestLap.id;

  const tabs = [
    { id: 'summary', label: '成绩总览', icon: Trophy },
    { id: 'physics', label: '物理曲线', icon: Gauge },
    { id: 'issues', label: '问题溯源', icon: AlertTriangle },
    { id: 'data', label: '中间数据', icon: Download }
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#1e3a5f]">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isBestLap ? 'bg-yellow-500/20' : 'bg-[#00d4ff]/20'
            }`}>
              <Trophy className={`w-6 h-6 ${isBestLap ? 'text-yellow-500' : 'text-[#00d4ff]'}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-['Orbitron'] tracking-wider">
                圈速结算
              </h2>
              <p className="text-sm text-gray-400">
                圈速ID: {currentLap.id} | {new Date(currentLap.startTime).toLocaleString('zh-CN')}
                {isBestLap && <span className="ml-2 text-yellow-500">🏆 最佳圈速</span>}
              </p>
            </div>
          </div>
          <button
            onClick={closeResults}
            className="p-2 hover:bg-[#1e3a5f] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex gap-1 p-2 bg-[#0a1628] border-b border-[#1e3a5f]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all
                ${activeTab === id 
                  ? 'bg-[#1e3a5f] text-[#00d4ff]' 
                  : 'text-gray-400 hover:text-white hover:bg-[#1e3a5f]/50'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f] text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-2">
                    <Clock className="w-4 h-4" />
                    总圈速
                  </div>
                  <div className="text-3xl font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider">
                    {formatTime(currentLap.totalTime)}
                  </div>
                </div>
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f] text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-2">
                    <Gauge className="w-4 h-4" />
                    最高速度
                  </div>
                  <div className="text-3xl font-bold text-[#ff6b35] font-['Orbitron'] tracking-wider">
                    {currentLap.maxSpeed.toFixed(1)}
                    <span className="text-lg text-gray-400 ml-1">km/h</span>
                  </div>
                </div>
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f] text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-2">
                    <Zap className="w-4 h-4" />
                    平均速度
                  </div>
                  <div className="text-3xl font-bold text-[#4ade80] font-['Orbitron'] tracking-wider">
                    {currentLap.avgSpeed.toFixed(1)}
                    <span className="text-lg text-gray-400 ml-1">km/h</span>
                  </div>
                </div>
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f] text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    问题数量
                  </div>
                  <div className={`text-3xl font-bold font-['Orbitron'] tracking-wider ${
                    currentLap.issues.length === 0 ? 'text-green-500' :
                    currentLap.issues.length <= 2 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {currentLap.issues.length}
                  </div>
                </div>
              </div>

              <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                <h3 className="text-sm font-medium text-gray-400 mb-3">分段计时</h3>
                <div className="grid grid-cols-3 gap-4">
                  {['S1', 'S2', 'S3'].map((sector, i) => (
                    <div key={sector} className="relative">
                      <div className="h-2 bg-[#1e3a5f] rounded-full mb-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            i === 0 ? 'bg-[#00d4ff]' : i === 1 ? 'bg-[#ff6b35]' : 'bg-[#4ade80]'
                          }`}
                          style={{ 
                            width: `${(currentLap.sectorTimes[i] / currentLap.totalTime) * 100}%` 
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-lg font-bold ${
                          i === 0 ? 'text-[#00d4ff]' : i === 1 ? 'text-[#ff6b35]' : 'text-[#4ade80]'
                        }`}>
                          {sector}
                        </span>
                        <span className="text-white font-mono font-bold">
                          {formatTime(currentLap.sectorTimes[i])}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {((currentLap.sectorTimes[i] / currentLap.totalTime) * 100).toFixed(1)}% 总时间
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <div className="flex items-center gap-2 text-[#ff6b35] mb-3">
                    <Car className="w-4 h-4" />
                    <span className="text-sm font-medium">赛车参数</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID:</span>
                      <span className="text-white">{currentLap.carParams.id.slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">来源:</span>
                      <span className="text-white">{currentLap.carParams.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">质量:</span>
                      <span className="text-white">{currentLap.carParams.mass} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">功率:</span>
                      <span className="text-white">{(currentLap.carParams.power / 1000).toFixed(0)} kW</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <div className="flex items-center gap-2 text-[#00d4ff] mb-3">
                    <Gauge className="w-4 h-4" />
                    <span className="text-sm font-medium">翼片配置</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID:</span>
                      <span className="text-white">{currentLap.wingConfig.id.slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">来源:</span>
                      <span className="text-white">{currentLap.wingConfig.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">角度:</span>
                      <span className="text-white">{currentLap.wingConfig.angle.toFixed(1)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">升阻比:</span>
                      <span className="text-white">
                        {(currentLap.wingConfig.liftFactor / currentLap.wingConfig.dragFactor).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <div className="flex items-center gap-2 text-[#4ade80] mb-3">
                    <Wind className="w-4 h-4" />
                    <span className="text-sm font-medium">风速数据</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID:</span>
                      <span className="text-white">{currentLap.windConfig.id.slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">来源:</span>
                      <span className="text-white">{currentLap.windConfig.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">风速:</span>
                      <span className="text-white">{currentLap.windConfig.speed.toFixed(0)} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">风向:</span>
                      <span className="text-white">{currentLap.windConfig.direction.toFixed(0)}°</span>
                    </div>
                  </div>
                </div>
              </div>

              {currentLap.issues.length > 0 && (
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">主要问题摘要</h3>
                  <pre className="text-xs text-gray-300 font-mono bg-[#0f1c33] p-3 rounded-lg whitespace-pre-wrap">
                    {generateDiagnosticReport(currentLap.issues)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'physics' && (
            <div className="space-y-6">
              <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                <h3 className="text-sm font-medium text-gray-400 mb-4">速度、阻力、下压力曲线</h3>
                <div className="h-64">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                <h3 className="text-sm font-medium text-gray-400 mb-4">抓地力变化曲线</h3>
                <div className="h-64">
                  <Line data={gripChartData} options={gripChartOptions} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <div className="flex items-center gap-2 text-[#ff6b35] mb-3">
                    <Wind className="w-4 h-4" />
                    <span className="text-sm font-medium">阻力统计</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">平均阻力:</span>
                      <span className="text-white font-mono">
                        {(currentLap.frameData.reduce((s, f) => s + f.physics.dragForce, 0) / currentLap.frameData.length / 1000).toFixed(2)} kN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最大阻力:</span>
                      <span className="text-red-400 font-mono">
                        {(Math.max(...currentLap.frameData.map(f => f.physics.dragForce)) / 1000).toFixed(2)} kN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">阻力能耗:</span>
                      <span className="text-white font-mono">
                        {(currentLap.frameData.reduce((s, f) => s + f.physics.dragForce * f.physics.speed * 0.016, 0) / 1000000).toFixed(2)} MJ
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <div className="flex items-center gap-2 text-[#00d4ff] mb-3">
                    <ArrowDown className="w-4 h-4" />
                    <span className="text-sm font-medium">下压力统计</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">平均下压力:</span>
                      <span className="text-white font-mono">
                        {(currentLap.frameData.reduce((s, f) => s + f.physics.downForce, 0) / currentLap.frameData.length / 1000).toFixed(2)} kN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最大下压力:</span>
                      <span className="text-[#00d4ff] font-mono">
                        {(Math.max(...currentLap.frameData.map(f => f.physics.downForce)) / 1000).toFixed(2)} kN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">下压力增益:</span>
                      <span className="text-white font-mono">
                        {((currentLap.frameData.reduce((s, f) => s + f.physics.downForce, 0) / currentLap.frameData.length) / (currentLap.carParams.mass * 9.81) * 100).toFixed(1)}% 车重
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                  <div className="flex items-center gap-2 text-[#4ade80] mb-3">
                    <Gauge className="w-4 h-4" />
                    <span className="text-sm font-medium">抓地力统计</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">平均抓地力:</span>
                      <span className="text-white font-mono">
                        {(currentLap.frameData.reduce((s, f) => s + f.physics.grip, 0) / currentLap.frameData.length).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最小抓地力:</span>
                      <span className="text-yellow-400 font-mono">
                        {Math.min(...currentLap.frameData.map(f => f.physics.grip)).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">低于阈值:</span>
                      <span className="text-red-400 font-mono">
                        {currentLap.frameData.filter(f => f.physics.grip < 0.65).length} 帧
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-4">
              {currentLap.issues.length === 0 ? (
                <div className="bg-[#0a1628] rounded-xl p-8 text-center border border-[#1e3a5f]">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="text-lg font-medium text-white mb-2">完美圈速！</div>
                  <div className="text-sm text-gray-400">
                    本次行驶未检测到阻力过大、抓地不足或弯道失控问题
                  </div>
                </div>
              ) : (
                currentLap.issues.map((issue, index) => (
                  <div key={issue.id} className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white font-bold">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span 
                              className="font-medium text-white"
                              style={{ color: getIssueTypeColor(issue.type) }}
                            >
                              {getIssueTypeLabel(issue.type)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              issue.severity >= 4 ? 'bg-red-500/20 text-red-400' :
                              issue.severity >= 3 ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              L{issue.severity} 级
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTime(issue.startTime)} - {formatTime(issue.endTime)} 
                            ({(issue.endTime - issue.startTime).toFixed(2)}s)
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="p-3 bg-[#0f1c33] rounded-lg">
                        <div className="text-[10px] text-gray-500 mb-1">触发阈值</div>
                        <div className="text-sm font-mono text-gray-300">
                          {issue.threshold.toFixed(2)}
                        </div>
                      </div>
                      <div className="p-3 bg-[#0f1c33] rounded-lg">
                        <div className="text-[10px] text-gray-500 mb-1">实际峰值</div>
                        <div className="text-sm font-mono text-red-400">
                          {issue.actualValue.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#1e3a5f]/30 rounded-lg mb-3">
                      <div className="text-[10px] text-gray-500 mb-1">触发溯源</div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">
                          {getSourceLabel(issue.triggerSource)}
                        </span>
                        <span className="font-mono text-[#00d4ff]">
                          ID: {issue.triggerId}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        数据标签: {currentLap[`${issue.triggerSource}Params` as keyof typeof currentLap]?.source || 
                                   currentLap[`${issue.triggerSource}Config` as keyof typeof currentLap]?.source}
                      </div>
                    </div>

                    <div className="p-3 bg-[#00d4ff]/10 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#00d4ff] flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-[#00d4ff]">
                          <span className="font-medium">建议：</span>
                          {issue.suggestion}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-gray-600">
                      影响帧: {issue.frames[0]}{issue.frames.length > 1 ? ` - ${issue.frames[issue.frames.length - 1]}` : ''} 
                      ({issue.frames.length} 帧) | 赛道位置: {(issue.trackPosition * 100).toFixed(1)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                <h3 className="text-sm font-medium text-gray-400 mb-3">数据导出</h3>
                <p className="text-xs text-gray-500 mb-4">
                  导出包含所有中间计算值的完整JSON文件，用于教学复核和问题追溯。
                  文件包含：圈速信息、原始参数、帧级物理数据、问题诊断记录。
                </p>
                <button
                  onClick={handleExport}
                  className="w-full py-3 px-4 bg-[#00d4ff] hover:bg-[#00a8cc] text-[#0a1628] font-medium rounded-lg
                    transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  导出完整数据 (JSON)
                </button>
              </div>

              <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                <h3 className="text-sm font-medium text-gray-400 mb-3">原始材料 vs 处理结果</h3>
                <div className="space-y-3">
                  {[
                    { type: '赛车参数', raw: currentLap.carParams.rawData, processed: {
                        mass: currentLap.carParams.mass,
                        power: currentLap.carParams.power,
                        Cd0: currentLap.carParams.baseDragCoeff,
                        Cl0: currentLap.carParams.baseLiftCoeff,
                        A: currentLap.carParams.frontalArea,
                        μ0: currentLap.carParams.tireGrip
                      }, source: currentLap.carParams.source, id: currentLap.carParams.id },
                    { type: '翼片配置', raw: currentLap.wingConfig.rawData, processed: {
                        angle: currentLap.wingConfig.angle,
                        dragFactor: currentLap.wingConfig.dragFactor,
                        liftFactor: currentLap.wingConfig.liftFactor,
                        L_D_ratio: (currentLap.wingConfig.liftFactor / currentLap.wingConfig.dragFactor).toFixed(3)
                      }, source: currentLap.wingConfig.source, id: currentLap.wingConfig.id },
                    { type: '风速数据', raw: currentLap.windConfig.rawData, processed: {
                        speed: currentLap.windConfig.speed,
                        direction: currentLap.windConfig.direction,
                        speed_ms: (currentLap.windConfig.speed / 3.6).toFixed(2)
                      }, source: currentLap.windConfig.source, id: currentLap.windConfig.id }
                  ].map((item, i) => (
                    <div key={i} className="border border-[#1e3a5f] rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#1e3a5f]/30">
                        <span className="text-sm font-medium text-white">{item.type}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400">来源: {item.source}</span>
                          <span className="font-mono text-[#00d4ff]">ID: {item.id.slice(0, 8)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-[#1e3a5f]">
                        <div className="p-3">
                          <div className="text-[10px] text-gray-500 mb-2">原始材料</div>
                          <pre className="text-[11px] text-gray-400 font-mono bg-[#0f1c33] p-2 rounded overflow-x-auto">
                            {item.raw}
                          </pre>
                        </div>
                        <div className="p-3">
                          <div className="text-[10px] text-gray-500 mb-2">处理结果</div>
                          <pre className="text-[11px] text-[#4ade80] font-mono bg-[#0f1c33] p-2 rounded overflow-x-auto">
                            {JSON.stringify(item.processed, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1e3a5f]">
                <h3 className="text-sm font-medium text-gray-400 mb-3">帧数据样本（前10帧）</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#1e3a5f]">
                        <th className="text-left py-2 px-2">帧</th>
                        <th className="text-right py-2 px-2">时间(s)</th>
                        <th className="text-right py-2 px-2">速度(m/s)</th>
                        <th className="text-right py-2 px-2">阻力(N)</th>
                        <th className="text-right py-2 px-2">下压力(N)</th>
                        <th className="text-right py-2 px-2">抓地力</th>
                        <th className="text-right py-2 px-2">位置</th>
                        <th className="text-left py-2 px-2">来源标签</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLap.frameData.slice(0, 10).map((frame) => (
                        <tr key={frame.frameNumber} className="border-b border-[#1e3a5f]/50 text-gray-300">
                          <td className="py-2 px-2">{frame.frameNumber}</td>
                          <td className="text-right py-2 px-2">{frame.timestamp.toFixed(2)}</td>
                          <td className="text-right py-2 px-2">{frame.physics.speed.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-[#ff6b35]">{frame.physics.dragForce.toFixed(0)}</td>
                          <td className="text-right py-2 px-2 text-[#00d4ff]">{frame.physics.downForce.toFixed(0)}</td>
                          <td className="text-right py-2 px-2 text-[#4ade80]">{frame.physics.grip.toFixed(3)}</td>
                          <td className="text-right py-2 px-2">{(frame.trackProgress * 100).toFixed(1)}%</td>
                          <td className="py-2 px-2 text-gray-500">{frame.sourceTag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  共 {currentLap.frameData.length} 帧数据，导出文件包含完整记录
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-[#1e3a5f] bg-[#0a1628]">
          <div className="text-xs text-gray-500">
            数据完整性：帧数据 {currentLap.frameData.length} 条 | 问题记录 {currentLap.issues.length} 条
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="py-2 px-4 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white text-sm rounded-lg
                transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出数据
            </button>
            <button
              onClick={resetToIdle}
              className="py-2 px-4 bg-[#00d4ff] hover:bg-[#00a8cc] text-[#0a1628] font-medium rounded-lg
                transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              开始新一局
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
