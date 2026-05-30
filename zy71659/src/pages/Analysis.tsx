import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ECharts } from 'echarts';
import { MainLayout } from '@/components/layout/MainLayout';
import { SpeedChart } from '@/components/charts/SpeedChart';
import { TorqueChart } from '@/components/charts/TorqueChart';
import { TempChart } from '@/components/charts/TempChart';
import { SampleTable } from '@/components/tables/SampleTable';
import { SegmentTable } from '@/components/tables/SegmentTable';
import { useAppStore } from '@/store/useAppStore';
import { runAnalysisForDevice } from '@/services/analysisService';
import { Modal } from '@/components/common/Modal';
import { AlignedSample, OperationSegment } from '@/types';
import { formatTime, formatTorque, formatSpeed, formatTemperature, formatLoadLevel } from '@/utils/formatters';
import { Play, RefreshCw, Filter, Download } from 'lucide-react';

const Analysis: React.FC = () => {
  const {
    currentDeviceId,
    alignedSamples,
    segments,
    anomalies,
    setAlignedSamples,
    setSegments,
    setAnomalies,
    highlightSample,
    refreshData,
  } = useAppStore();

  const [sampleDetail, setSampleDetail] = useState<AlignedSample | null>(null);
  const [segmentDetail, setSegmentDetail] = useState<OperationSegment | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [showSegmentFilter, setShowSegmentFilter] = useState(false);
  const [filterLoadLevel, setFilterLoadLevel] = useState<number | null>(null);

  const speedChartRef = useRef<ECharts | null>(null);
  const torqueChartRef = useRef<ECharts | null>(null);
  const tempChartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (alignedSamples.length === 0) {
        await handleRunAnalysis();
      }
    };
    loadData();
  }, []);

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    try {
      const result = await runAnalysisForDevice(currentDeviceId, {});
      setAlignedSamples(result.alignedSamples);
      setSegments(result.segments);
      setAnomalies(result.anomalies);
      await refreshData();
    } catch (error) {
      console.error('分析失败:', error);
    } finally {
      setAnalysisRunning(false);
    }
  };

  const syncDataZoom = useCallback((chart: ECharts | null) => {
    if (!chart) return;
    chart.on('dataZoom', (params: { batch: Array<{ startValue: number; endValue: number }> }) => {
      const batch = params.batch?.[0];
      if (!batch) return;

      [speedChartRef.current, torqueChartRef.current, tempChartRef.current].forEach((c) => {
        if (c && c !== chart) {
          c.dispatchAction({
            type: 'dataZoom',
            startValue: batch.startValue,
            endValue: batch.endValue,
          });
        }
      });
    });
  }, []);

  const handleSpeedChartReady = (chart: ECharts) => {
    speedChartRef.current = chart;
    syncDataZoom(chart);
  };

  const handleTorqueChartReady = (chart: ECharts) => {
    torqueChartRef.current = chart;
    syncDataZoom(chart);
  };

  const handleTempChartReady = (chart: ECharts) => {
    tempChartRef.current = chart;
    syncDataZoom(chart);
  };

  const filteredSamples = filterLoadLevel !== null
    ? alignedSamples.filter(s => s.loadLevel === filterLoadLevel)
    : alignedSamples;

  const filteredSegments = filterLoadLevel !== null
    ? segments.filter(s => s.loadLevel === filterLoadLevel)
    : segments;

  const exportCurrentData = () => {
    const dataStr = JSON.stringify({
      samples: filteredSamples,
      segments: filteredSegments,
      anomalies: anomalies,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${currentDeviceId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout onRefresh={handleRunAnalysis} onImport={handleRunAnalysis} onExport={exportCurrentData}>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">数据分析</h1>
            <p className="text-sm text-slate-400 mt-1">
              设备 {currentDeviceId} · 多维度曲线联动分析
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                className={`btn flex items-center gap-2 py-1.5 ${showSegmentFilter ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowSegmentFilter(!showSegmentFilter)}
              >
                <Filter size={16} />
                <span>负载筛选</span>
              </button>
              <button
                className="btn btn-ghost flex items-center gap-2 py-1.5"
                onClick={exportCurrentData}
              >
                <Download size={16} />
                <span>导出数据</span>
              </button>
              <button
                className="btn btn-primary flex items-center gap-2 py-1.5"
                onClick={handleRunAnalysis}
                disabled={analysisRunning}
              >
                <Play size={16} className={analysisRunning ? 'animate-spin' : ''} />
                <span>重新分析</span>
              </button>
            </div>
          </div>
        </div>

        {showSegmentFilter && (
          <div className="card p-4 animate-slide-in">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">按负载档筛选:</span>
              <div className="flex items-center gap-2">
                <button
                  className={`px-3 py-1.5 text-sm rounded-sm border transition-colors ${
                    filterLoadLevel === null
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                  }`}
                  onClick={() => setFilterLoadLevel(null)}
                >
                  全部
                </button>
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    className={`px-3 py-1.5 text-sm rounded-sm border transition-colors ${
                      filterLoadLevel === level
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                    onClick={() => setFilterLoadLevel(level)}
                  >
                    {level} 档
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500 ml-4">
                显示 {filteredSamples.length} 条采样 / {filteredSegments.length} 个工况段
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div className="h-64">
            <SpeedChart
              samples={filteredSamples}
              anomalies={anomalies}
              onChartReady={handleSpeedChartReady}
            />
          </div>
          <div className="h-64">
            <TorqueChart
              samples={filteredSamples}
              anomalies={anomalies}
              onChartReady={handleTorqueChartReady}
            />
          </div>
          <div className="h-64">
            <TempChart
              samples={filteredSamples}
              anomalies={anomalies}
              onChartReady={handleTempChartReady}
            />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={`card p-3 cursor-pointer transition-all hover:bg-slate-700/50 ${
                filterLoadLevel === segment.loadLevel ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setFilterLoadLevel(
                filterLoadLevel === segment.loadLevel ? null : segment.loadLevel
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">负载档</span>
                <span className="text-lg font-semibold text-amber-400">{segment.loadLevel}</span>
              </div>
              <div className="text-xs text-slate-500">
                {segment.sampleCount} 采样 · 平均扭矩 {segment.avgTorque.toFixed(1)} N·m
              </div>
              {segment.hasAnomaly && (
                <div className="mt-2 text-xs text-red-400">⚠️ 含 {segment.anomalyIds.length} 个异常</div>
              )}
            </div>
          ))}
        </div>

        <SegmentTable
          segments={filteredSegments}
          onViewDetail={(segment) => setSegmentDetail(segment)}
        />

        <SampleTable
          samples={filteredSamples}
          onViewDetail={(sample) => setSampleDetail(sample)}
        />

        <Modal
          isOpen={!!sampleDetail}
          onClose={() => setSampleDetail(null)}
          title="采样数据详情 - 可追溯"
          size="lg"
        >
          {sampleDetail && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-sm">
                <div className="text-xs text-blue-400 mb-1">🔗 数据溯源路径</div>
                <div className="text-sm font-mono text-slate-300">
                  原始采样 #{sampleDetail.rawSampleId.slice(-8)}
                  {' → '}
                  对齐采样 #{sampleDetail.id?.slice(-8)}
                  {sampleDetail.segmentId && ` → 工况段 #${sampleDetail.segmentId.slice(-8)}`}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">采样时间</div>
                  <div className="text-sm font-mono text-slate-200">
                    {formatTime(sampleDetail.timestamp)}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">对齐状态</div>
                  <div className="text-sm">
                    {sampleDetail.alignmentStatus === 'ok' ? '✅ 正常' :
                     sampleDetail.alignmentStatus === 'shifted' ? `⚠️ 偏移 ${sampleDetail.shiftOffset}ms` :
                     sampleDetail.alignmentStatus === 'interpolated' ? '🔄 插值补全' : '❌ 数据缺失'}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">负载档位</div>
                  <div className="text-lg font-semibold text-amber-400">
                    {formatLoadLevel(sampleDetail.loadLevel)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-sm">
                  <div className="text-xs text-blue-400 mb-1">转速</div>
                  <div className="text-2xl font-mono text-blue-400">
                    {formatSpeed(sampleDetail.speed)}
                  </div>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-sm">
                  <div className="text-xs text-emerald-400 mb-1">扭矩</div>
                  <div className="text-2xl font-mono text-emerald-400">
                    {formatTorque(sampleDetail.torque)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    原始值: {sampleDetail.torqueRaw.toFixed(2)}
                  </div>
                </div>
                <div className={`border p-4 rounded-sm ${
                  sampleDetail.temperature > 130
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-slate-900/50 border-slate-700'
                }`}>
                  <div className={`text-xs mb-1 ${
                    sampleDetail.temperature > 130 ? 'text-red-400' : 'text-slate-400'
                  }`}>温度</div>
                  <div className={`text-2xl font-mono ${
                    sampleDetail.temperature > 130 ? 'text-red-400' : 'text-slate-300'
                  }`}>
                    {formatTemperature(sampleDetail.temperature)}
                  </div>
                  {sampleDetail.temperature > 130 && (
                    <div className="text-xs text-red-400 mt-1">⚠️ 超出安全阈值</div>
                  )}
                </div>
              </div>

              {sampleDetail.anomalyIds.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-sm">
                  <div className="text-xs text-red-400 mb-2">⚠️ 关联异常事件 ({sampleDetail.anomalyIds.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {sampleDetail.anomalyIds.map((id) => (
                      <button
                        key={id}
                        className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded-sm border border-red-500/30 hover:bg-red-500/20 transition-colors"
                        onClick={() => useAppStore.getState().highlightAnomaly(id)}
                      >
                        #{id.slice(-8)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        <Modal
          isOpen={!!segmentDetail}
          onClose={() => setSegmentDetail(null)}
          title="工况段详情"
          size="lg"
        >
          {segmentDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">负载档位</div>
                  <div className="text-2xl font-semibold text-amber-400">
                    {segmentDetail.loadLevel}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">采样点数</div>
                  <div className="text-2xl font-mono text-slate-200">
                    {segmentDetail.sampleCount}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">开始时间</div>
                  <div className="text-sm font-mono text-slate-200">
                    {formatTime(segmentDetail.startTime)}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">结束时间</div>
                  <div className="text-sm font-mono text-slate-200">
                    {formatTime(segmentDetail.endTime)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-sm">
                  <div className="text-xs text-blue-400 mb-1">平均转速</div>
                  <div className="text-xl font-mono text-blue-400">
                    {formatSpeed(segmentDetail.avgSpeed)}
                  </div>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-sm">
                  <div className="text-xs text-emerald-400 mb-1">扭矩范围</div>
                  <div className="text-sm font-mono text-emerald-400">
                    {formatTorque(segmentDetail.minTorque)} ~ {formatTorque(segmentDetail.maxTorque)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    平均: {formatTorque(segmentDetail.avgTorque)}
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-sm">
                  <div className="text-xs text-slate-400 mb-1">平均温度</div>
                  <div className="text-xl font-mono text-slate-300">
                    {formatTemperature(segmentDetail.avgTemperature)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    最高: {formatTemperature(segmentDetail.maxTemperature)}
                  </div>
                </div>
              </div>

              {segmentDetail.hasAnomaly && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-sm">
                  <div className="text-xs text-red-400 mb-2">⚠️ 工况段内异常事件</div>
                  <div className="flex flex-wrap gap-2">
                    {segmentDetail.anomalyIds.map((id) => (
                      <button
                        key={id}
                        className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded-sm border border-red-500/30 hover:bg-red-500/20 transition-colors"
                        onClick={() => {
                          useAppStore.getState().highlightAnomaly(id);
                          setSegmentDetail(null);
                        }}
                      >
                        查看异常 #{id.slice(-8)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setSegmentDetail(null)}
                >
                  关闭
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const samples = alignedSamples.filter(
                      s => s.timestamp >= segmentDetail.startTime && s.timestamp <= segmentDetail.endTime
                    );
                    samples.forEach(s => highlightSample(s.id!));
                    setSegmentDetail(null);
                  }}
                >
                  在图表中定位
                </button>
              </div>
            </div>
          )}
        </Modal>

        {analysisRunning && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card p-8 text-center">
              <div className="w-16 h-16 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-base text-slate-300 font-medium">正在执行完整数据分析流水线</div>
              <div className="text-xs text-slate-500 mt-3 space-y-1">
                <div>✓ 扭矩物理量计算</div>
                <div>✓ 多通道互相关曲线对齐</div>
                <div className="text-blue-400">⟳ 工况段自动划分...</div>
                <div className="text-slate-600">○ 业务异常检测</div>
                <div className="text-slate-600">○ 结果持久化存储</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Analysis;
