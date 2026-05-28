import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Filter, Download } from 'lucide-react';
import AccelerationChart from '@/components/charts/AccelerationChart';
import FpsChart from '@/components/charts/FpsChart';
import AnomalyCard from '@/components/ui/AnomalyCard';
import { useSessionStore } from '@/store/sessionStore';
import { cn } from '@/lib/utils';

export default function SessionAnalysis() {
  const {
    currentSession,
    accelerationData,
    frameData,
    segmentData,
    feedbackData,
    anomalyData,
    selectedAnomalyId,
    selectAnomaly,
  } = useSessionStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredAnomalies = anomalyData.filter((a) => {
    if (filterStatus === 'all') return true;
    return a.reviewStatus === filterStatus;
  });

  const selectedAnomaly = anomalyData.find((a) => a.id === selectedAnomalyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">会话分析</h1>
          <p className="text-dark-400 mt-1">
            {currentSession?.sessionName || '未选择会话'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-sm text-dark-200 hover:bg-dark-600 transition-colors">
            <Download className="w-4 h-4" />
            导出数据
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-white">镜头段落</h3>
              <div className="flex items-center gap-2">
                {segmentData.map((seg, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-xs text-dark-400">{seg.segmentName}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex h-8 rounded-lg overflow-hidden">
              {segmentData.map((seg) => (
                <div
                  key={seg.id}
                  className="h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    width: `${((seg.endTime - seg.startTime) / (currentSession?.duration || 100)) * 100}%`,
                    backgroundColor: seg.color,
                  }}
                  title={`${seg.segmentName}: ${seg.startTime}s - ${seg.endTime}s`}
                >
                  <span className="text-xs font-medium text-white/80 px-2 truncate">
                    {seg.segmentName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <AccelerationChart
            data={accelerationData}
            anomalies={anomalyData}
            feedbacks={feedbackData}
            segments={segmentData}
            height={350}
          />

          <FpsChart data={frameData} height={200} />

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                  className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-dark-300"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 rounded-xl bg-primary-500 hover:bg-primary-600 transition-colors text-white"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setCurrentTime(Math.min(currentSession?.duration || 100, currentTime + 5))}
                  className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-dark-300"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <div className="ml-4 text-sm text-dark-300">
                  <span className="font-mono text-white">{currentTime.toFixed(1)}</span>
                  <span className="text-dark-500"> / {currentSession?.duration.toFixed(1) || '0'}s</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.2))}
                  className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-dark-300"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.2))}
                  className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-dark-300"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-dark-400 ml-2">
                  {(zoomLevel * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="mt-4 relative h-2 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${(currentTime / (currentSession?.duration || 100)) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={currentSession?.duration || 100}
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-white">异常点列表</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-dark-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-xs text-dark-200 focus:outline-none focus:border-primary-500"
              >
                <option value="all">全部</option>
                <option value="pending">待处理</option>
                <option value="needs_review">待复核</option>
                <option value="confirmed">已确认</option>
                <option value="false_positive">误报</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
            {filteredAnomalies.map((anomaly) => (
              <AnomalyCard
                key={anomaly.id}
                anomaly={anomaly}
                selected={selectedAnomalyId === anomaly.id}
                onClick={() => selectAnomaly(selectedAnomalyId === anomaly.id ? null : anomaly.id)}
                compact
              />
            ))}
          </div>
        </div>
      </div>

      {selectedAnomaly && (
        <div className="fixed bottom-0 left-64 right-0 bg-dark-900/95 backdrop-blur-md border-t border-dark-600 p-4 z-50">
          <div className="flex items-start gap-6 max-w-7xl mx-auto">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-semibold text-white">选中异常点详情</h4>
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  selectedAnomaly.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                  selectedAnomaly.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  selectedAnomaly.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                )}>
                  {selectedAnomaly.severity === 'critical' ? '严重' :
                   selectedAnomaly.severity === 'high' ? '高' :
                   selectedAnomaly.severity === 'medium' ? '中' : '低'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-dark-400">时间范围:</span>
                  <span className="text-white ml-2">
                    {selectedAnomaly.startTime.toFixed(1)}s - {selectedAnomaly.endTime.toFixed(1)}s
                  </span>
                </div>
                <div>
                  <span className="text-dark-400">峰值加速度:</span>
                  <span className="text-white ml-2">{selectedAnomaly.peakAcceleration.toFixed(2)} m/s²</span>
                </div>
                <div>
                  <span className="text-dark-400">持续时间:</span>
                  <span className="text-white ml-2">{selectedAnomaly.duration.toFixed(2)}s</span>
                </div>
                <div>
                  <span className="text-dark-400">置信度:</span>
                  <span className="text-white ml-2">{(selectedAnomaly.confidence * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-dark-400">匹配规则:</span>
                  <span className="text-white ml-2">{selectedAnomaly.matchedRules.length}条</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => selectAnomaly(null)}
              className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
