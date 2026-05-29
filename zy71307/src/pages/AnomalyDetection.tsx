import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Gauge, Zap, Scale } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { AnomalyBadge } from '@/components/AnomalyBadge';
import { ChartCard } from '@/components/ChartCard';
import Empty from '@/components/Empty';
import { getAnomalyTypeLabel, getSeverityColor } from '@/utils/anomaly';
import type { EChartsOption } from 'echarts';
import type { AnomalyPoint, DataPoint } from '@/types';

export const AnomalyDetection: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const {
    experiments,
    loadExperiment,
    runAnomalyDetection,
    getCurrentExperiment,
    updateAnomalyInclusion,
    toggleExcludeDataPoint,
  } = useExperimentStore();

  useEffect(() => {
    if (id && !experiments.some(e => e.id === id)) {
      loadExperiment(id);
    }
  }, [id, experiments, loadExperiment]);

  const exp = getCurrentExperiment();

  const anomalyStats = useMemo(() => {
    if (!exp) return { total: 0, rpm_missing: 0, voltage_sag: 0, unit_error: 0, critical: 0, error: 0, warning: 0 };

    const stats = {
      total: exp.anomalies.length,
      rpm_missing: 0,
      voltage_sag: 0,
      unit_error: 0,
      critical: 0,
      error: 0,
      warning: 0,
    };

    exp.anomalies.forEach(a => {
      stats[a.type as keyof typeof stats]++;
      stats[a.severity as keyof typeof stats]++;
    });

    return stats;
  }, [exp]);

  const filteredAnomalies = useMemo(() => {
    if (!exp) return [];
    if (activeFilter === 'all') return exp.anomalies;
    return exp.anomalies.filter(a => a.type === activeFilter);
  }, [exp, activeFilter]);

  const getDataPoint = (dataPointId: string): DataPoint | undefined => {
    return exp?.dataPoints.find(p => p.id === dataPointId);
  };

  const anomalyDistributionChart = useMemo<EChartsOption>(() => {
    if (!exp) return {};

    const rpmData = exp.dataPoints.map(p => p.rpm);
    const voltageData = exp.dataPoints.map(p => p.voltage);
    const thrustData = exp.dataPoints.map(p => p.thrust);

    const anomalyPointIds = new Set(exp.anomalies.map(a => a.dataPointId));
    const anomalyIndices = exp.dataPoints
      .map((p, i) => anomalyPointIds.has(p.id) ? i : -1)
      .filter(i => i >= 0);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          const point = exp?.dataPoints[idx];
          if (!point) return '';
          const hasAnomaly = anomalyPointIds.has(point.id);
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">数据点 #${idx + 1}</div>
              <div>转速: ${point.rpm} RPM</div>
              <div>电压: ${point.voltage} V</div>
              <div>推力: ${point.thrust} ${point.thrustUnit}</div>
              ${hasAnomaly ? '<div style="color: #f97316; margin-top: 4px;">⚠ 存在异常</div>' : ''}
            </div>
          `;
        },
      },
      grid: { left: '10%', right: '5%', top: '10%', bottom: '15%' },
      xAxis: {
        type: 'category',
        data: exp.dataPoints.map((_, i) => `#${i + 1}`),
        name: '数据点',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono', rotate: 45 },
      },
      yAxis: [
        {
          type: 'value',
          name: '转速/电压',
          nameTextStyle: { color: '#94a3b8', fontSize: 12 },
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        },
        {
          type: 'value',
          name: `推力 (${exp.fittingParams.thrustUnit})`,
          nameTextStyle: { color: '#94a3b8', fontSize: 12 },
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '转速',
          type: 'line',
          yAxisIndex: 0,
          data: rpmData,
          lineStyle: { color: '#06b6d4', width: 2 },
          itemStyle: { color: '#06b6d4' },
          markPoint: {
            symbol: 'diamond',
            symbolSize: 10,
            itemStyle: { color: '#ef4444' },
            data: anomalyIndices.map(i => ({ coord: [i, rpmData[i]], name: '异常' })),
            label: { show: false },
          },
        },
        {
          name: '电压',
          type: 'line',
          yAxisIndex: 0,
          data: voltageData,
          lineStyle: { color: '#f59e0b', width: 2 },
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: '推力',
          type: 'line',
          yAxisIndex: 1,
          data: thrustData,
          lineStyle: { color: '#10b981', width: 2, type: 'dashed' },
          itemStyle: { color: '#10b981' },
        },
      ],
      legend: {
        data: ['转速', '电压', '推力'],
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
    };
  }, [exp]);

  const typeDistributionChart = useMemo<EChartsOption>(() => {
    if (!exp) return {};

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: '{b}: {c} 个 ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#0f172a',
            borderWidth: 2,
          },
          label: {
            show: true,
            color: '#94a3b8',
            fontFamily: 'Space Grotesk',
          },
          data: [
            { value: anomalyStats.rpm_missing, name: '转速缺样', itemStyle: { color: '#f97316' } },
            { value: anomalyStats.voltage_sag, name: '电压骤降', itemStyle: { color: '#eab308' } },
            { value: anomalyStats.unit_error, name: '单位错误', itemStyle: { color: '#ef4444' } },
          ],
        },
      ],
    };
  }, [exp, anomalyStats]);

  if (!exp) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (exp.anomalies.length === 0) {
    return (
      <Empty
        icon={AlertTriangle}
        title="未检测到异常"
        description="当前数据集中未发现转速缺样、电压骤降或单位错误等异常"
        action={{
          label: '重新检测',
          onClick: () => runAnomalyDetection(),
        }}
      />
    );
  }

  const typeIcons: Record<string, React.ReactNode> = {
    rpm_missing: <Gauge size={16} />,
    voltage_sag: <Zap size={16} />,
    unit_error: <Scale size={16} />,
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100 flex items-center gap-3">
            <AlertTriangle className="text-alert-orange" size={28} />
            异常检测
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            自动检测转速缺样、电压骤降、推力单位错误三类异常 | 总数据点: {exp.dataPoints.length} 个
          </p>
        </div>
        <button
          onClick={() => runAnomalyDetection()}
          className="flex items-center gap-2 px-4 py-2 border border-industrial-600 rounded-lg text-gray-300 hover:bg-industrial-800 transition-colors"
        >
          <RefreshCw size={16} />
          <span className="text-sm font-medium">重新检测</span>
        </button>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">异常总数</p>
          <p className="text-2xl font-bold font-mono text-alert-orange">{anomalyStats.total}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">转速缺样</p>
          <p className="text-2xl font-bold font-mono text-alert-orange">{anomalyStats.rpm_missing}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">电压骤降</p>
          <p className="text-2xl font-bold font-mono text-alert-yellow">{anomalyStats.voltage_sag}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">单位错误</p>
          <p className="text-2xl font-bold font-mono text-alert-red">{anomalyStats.unit_error}</p>
        </div>
        <div className="bg-industrial-800 border border-alert-red/30 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">严重</p>
          <p className="text-2xl font-bold font-mono text-alert-red">{anomalyStats.critical}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">已排除</p>
          <p className="text-2xl font-bold font-mono text-gray-500">{exp.dataPoints.filter(p => p.isExcluded).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <ChartCard
          title="异常分布图"
          subtitle="数据序列中的异常位置标记"
          option={anomalyDistributionChart}
          height={300}
          className="col-span-2"
        />
        <ChartCard
          title="异常类型分布"
          subtitle="各类异常占比"
          option={typeDistributionChart}
          height={300}
        />
      </div>

      <div className="bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-industrial-700">
          {(['all', 'rpm_missing', 'voltage_sag', 'unit_error'] as const).map(type => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeFilter === type
                  ? 'bg-tech-500/20 text-tech-400 border border-tech-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-industrial-700'
              }`}
            >
              {type !== 'all' && typeIcons[type]}
              {type === 'all' ? '全部' : getAnomalyTypeLabel(type)}
              <span className="text-xs font-mono">
                ({type === 'all' ? anomalyStats.total : anomalyStats[type as keyof typeof anomalyStats]})
              </span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-industrial-700">
          {filteredAnomalies.map((anomaly) => {
            const dataPoint = getDataPoint(anomaly.dataPointId);
            const isExpanded = expandedAnomaly === anomaly.id;
            const severityColor = getSeverityColor(anomaly.severity);

            return (
              <div key={anomaly.id} className="bg-industrial-800">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-industrial-700/50 transition-colors"
                  onClick={() => setExpandedAnomaly(isExpanded ? null : anomaly.id)}
                >
                  <div
                    className="w-1 h-12 rounded-full"
                    style={{ backgroundColor: severityColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <AnomalyBadge type={anomaly.type} severity={anomaly.severity} />
                      <span className="text-xs text-gray-500 font-mono">
                        数据点 #{dataPoint ? exp.dataPoints.findIndex(p => p.id === dataPoint.id) + 1 : 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200">{anomaly.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {dataPoint && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExcludeDataPoint(dataPoint.id);
                        }}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          dataPoint.isExcluded
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-alert-orange/20 text-alert-orange hover:bg-alert-orange/30'
                        }`}
                      >
                        {dataPoint.isExcluded ? '已排除' : '排除数据'}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateAnomalyInclusion(anomaly.id, !anomaly.isIncludedInReport);
                      }}
                      className={`p-2 rounded transition-colors ${
                        anomaly.isIncludedInReport
                          ? 'text-tech-400 hover:bg-tech-500/10'
                          : 'text-gray-500 hover:bg-industrial-700'
                      }`}
                      title={anomaly.isIncludedInReport ? '报告中包含' : '报告中排除'}
                    >
                      {anomaly.isIncludedInReport ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-200">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-industrial-900 rounded-lg p-4 ml-5">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">计算详情</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-industrial-950 rounded p-3">
                          <p className="text-xs text-gray-500 mb-1">期望值</p>
                          <p className="text-lg font-mono text-gray-100">{anomaly.calculationDetails.expectedValue.toFixed(4)}</p>
                        </div>
                        <div className="bg-industrial-950 rounded p-3">
                          <p className="text-xs text-gray-500 mb-1">实际值</p>
                          <p className="text-lg font-mono" style={{ color: severityColor }}>
                            {anomaly.calculationDetails.actualValue.toFixed(4)}
                          </p>
                        </div>
                        <div className="bg-industrial-950 rounded p-3">
                          <p className="text-xs text-gray-500 mb-1">阈值</p>
                          <p className="text-lg font-mono text-gray-100">{anomaly.calculationDetails.threshold.toFixed(4)}</p>
                        </div>
                        <div className="bg-industrial-950 rounded p-3">
                          <p className="text-xs text-gray-500 mb-1">偏差</p>
                          <p className="text-lg font-mono" style={{ color: severityColor }}>
                            {anomaly.calculationDetails.deviation.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-industrial-950 rounded p-3">
                        <p className="text-xs text-gray-500 mb-2">计算公式</p>
                        <p className="text-sm font-mono text-tech-400 break-all">
                          {anomaly.calculationDetails.formula}
                        </p>
                      </div>
                      {dataPoint && (
                        <div className="mt-4 pt-4 border-t border-industrial-800">
                          <h5 className="text-sm font-medium text-gray-400 mb-2">原始数据</h5>
                          <div className="grid grid-cols-5 gap-3 text-xs">
                            <div>
                              <p className="text-gray-500">转速</p>
                              <p className="font-mono text-gray-200">{dataPoint.rpm} RPM</p>
                            </div>
                            <div>
                              <p className="text-gray-500">电压</p>
                              <p className="font-mono text-gray-200">{dataPoint.voltage} V</p>
                            </div>
                            <div>
                              <p className="text-gray-500">电流</p>
                              <p className="font-mono text-gray-200">{dataPoint.current} A</p>
                            </div>
                            <div>
                              <p className="text-gray-500">桨径</p>
                              <p className="font-mono text-gray-200">{dataPoint.propellerDiameter} inch</p>
                            </div>
                            <div>
                              <p className="text-gray-500">推力</p>
                              <p className="font-mono text-gray-200">{dataPoint.thrust} {dataPoint.thrustUnit}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
        <h3 className="font-display text-lg font-semibold text-gray-100 mb-4">检测算法说明</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-industrial-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="text-alert-orange" size={20} />
              <h4 className="font-medium text-gray-100">转速缺样检测</h4>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              检查按转速排序后的数据点，相邻两点的转速差是否超过采样间隔的 1.5 倍。
            </p>
            <div className="bg-industrial-950 rounded p-3">
              <p className="text-xs font-mono text-tech-400">
                偏差 = 当前转速 - (上一转速 + 采样间隔)
              </p>
              <p className="text-xs font-mono text-gray-500 mt-2">
                采样间隔: {exp.fittingParams.rpmSamplingInterval} RPM
              </p>
            </div>
          </div>
          <div className="bg-industrial-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="text-alert-yellow" size={20} />
              <h4 className="font-medium text-gray-100">电压骤降检测</h4>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              以时序前5个点的电压为基准，检测连续3个点以上电压下降超过阈值。
            </p>
            <div className="bg-industrial-950 rounded p-3">
              <p className="text-xs font-mono text-tech-400">
                下降率 = (基准电压 - 当前电压) / 基准 × 100%
              </p>
              <p className="text-xs font-mono text-gray-500 mt-2">
                阈值: {exp.fittingParams.voltageSagThreshold}%
              </p>
            </div>
          </div>
          <div className="bg-industrial-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="text-alert-red" size={20} />
              <h4 className="font-medium text-gray-100">单位错误检测</h4>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              统一转换推力单位后，使用 Z-score 检测偏离均值超过阈值的异常点。
            </p>
            <div className="bg-industrial-950 rounded p-3">
              <p className="text-xs font-mono text-tech-400">
                Z-score = (x - μ) / σ
              </p>
              <p className="text-xs font-mono text-gray-500 mt-2">
                阈值: {exp.fittingParams.outlierThreshold}σ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
