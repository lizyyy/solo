import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Gauge, RefreshCw, Zap, Target, Activity, TrendingUp } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { ChartCard } from '@/components/ChartCard';
import { CalculationSteps } from '@/components/CalculationSteps';
import Empty from '@/components/Empty';
import type { EChartsOption } from 'echarts';

export const EfficiencyAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showSteps, setShowSteps] = useState(false);

  const {
    experiments,
    loadExperiment,
    runEfficiencyCalculation,
    getCurrentExperiment,
    getFilteredDataPoints,
  } = useExperimentStore();

  useEffect(() => {
    if (id && !experiments.some(e => e.id === id)) {
      loadExperiment(id);
    }
  }, [id, experiments, loadExperiment]);

  const exp = getCurrentExperiment();
  const filteredPoints = getFilteredDataPoints();

  const efficiencyChartOption = useMemo<EChartsOption>(() => {
    if (!exp?.efficiencyResult) return {};

    const { efficiencyCurve, optimalOperatingPoint, efficientRange } = exp.efficiencyResult;
    const thrustUnit = exp.fittingParams.thrustUnit;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const point = efficiencyCurve[params[0]?.dataIndex];
          if (!point) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">工作点 #${params[0].dataIndex + 1}</div>
              <div>转速: ${point.rpm} RPM</div>
              <div>输入功率: ${point.power.toFixed(2)} W</div>
              <div>推力: ${point.thrust.toFixed(4)} ${thrustUnit}</div>
              <div>推进效率: <span style="color: #10b981; font-weight: bold;">${point.efficiency.toFixed(2)}%</span></div>
            </div>
          `;
        },
      },
      grid: { left: '10%', right: '10%', top: '15%', bottom: '15%' },
      xAxis: {
        type: 'value',
        name: '转速 (RPM)',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '推进效率 (%)',
          nameTextStyle: { color: '#94a3b8', fontSize: 12 },
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          min: 0,
          max: 100,
        },
        {
          type: 'value',
          name: `推力 (${thrustUnit})`,
          nameTextStyle: { color: '#94a3b8', fontSize: 12 },
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '推进效率',
          type: 'line',
          yAxisIndex: 0,
          data: efficiencyCurve.map(p => [p.rpm, p.efficiency]),
          smooth: true,
          lineStyle: { color: '#10b981', width: 3 },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
              ],
            },
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(16, 185, 129, 0.1)' },
            data: [[
              { xAxis: efficientRange.minRpm },
              { xAxis: efficientRange.maxRpm },
            ]],
          },
          markPoint: {
            data: [
              {
                type: 'max',
                name: '最高效率',
                symbol: 'diamond',
                symbolSize: 12,
                itemStyle: { color: '#f59e0b' },
                label: {
                  formatter: '最佳效率点',
                  color: '#f59e0b',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                },
              },
            ],
          },
        },
        {
          name: '推力',
          type: 'line',
          yAxisIndex: 1,
          data: efficiencyCurve.map(p => [p.rpm, p.thrust]),
          smooth: true,
          lineStyle: { color: '#06b6d4', width: 2, type: 'dashed' },
          itemStyle: { color: '#06b6d4' },
        },
      ],
      legend: {
        data: ['推进效率', '推力'],
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          bottom: 10,
          style: {
            text: `高效区间: ${efficientRange.minRpm} - ${efficientRange.maxRpm} RPM | 最低效率: ${efficientRange.minEfficiency.toFixed(1)}%`,
            fill: '#94a3b8',
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
          },
        },
      ],
    };
  }, [exp]);

  const powerChartOption = useMemo<EChartsOption>(() => {
    if (!exp?.efficiencyResult) return {};

    const { efficiencyCurve } = exp.efficiencyResult;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
      },
      grid: { left: '10%', right: '5%', top: '10%', bottom: '15%' },
      xAxis: {
        type: 'value',
        name: '转速 (RPM)',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: '功率 (W)',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      series: [
        {
          name: '输入功率 (V×I)',
          type: 'line',
          data: efficiencyCurve.map(p => [p.rpm, p.power]),
          smooth: true,
          lineStyle: { color: '#f59e0b', width: 2 },
          itemStyle: { color: '#f59e0b' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 158, 11, 0.2)' },
                { offset: 1, color: 'rgba(245, 158, 11, 0.02)' },
              ],
            },
          },
        },
        {
          name: '推力功率',
          type: 'line',
          data: efficiencyCurve.map(p => [p.rpm, p.thrustPower]),
          smooth: true,
          lineStyle: { color: '#8b5cf6', width: 2 },
          itemStyle: { color: '#8b5cf6' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.2)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.02)' },
              ],
            },
          },
        },
      ],
      legend: {
        data: ['输入功率 (V×I)', '推力功率'],
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
    };
  }, [exp]);

  const thrustPowerChartOption = useMemo<EChartsOption>(() => {
    if (!exp?.efficiencyResult) return {};

    const { efficiencyCurve } = exp.efficiencyResult;
    const thrustUnit = exp.fittingParams.thrustUnit;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const p = params[0];
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
              <div>功率: ${p.data[0].toFixed(2)} W</div>
              <div>推力: ${p.data[1].toFixed(4)} ${thrustUnit}</div>
            </div>
          `;
        },
      },
      grid: { left: '10%', right: '5%', top: '10%', bottom: '15%' },
      xAxis: {
        type: 'value',
        name: '输入功率 (W)',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: `推力 (${thrustUnit})`,
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      series: [
        {
          name: '功率-推力曲线',
          type: 'line',
          data: efficiencyCurve.map(p => [p.power, p.thrust]),
          smooth: true,
          lineStyle: { color: '#ec4899', width: 2 },
          itemStyle: { color: '#ec4899' },
          symbol: 'circle',
          symbolSize: 8,
        },
      ],
    };
  }, [exp]);

  if (!exp) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!exp.efficiencyResult) {
    return (
      <Empty
        icon={Gauge}
        title="尚无效率分析结果"
        description="请先在数据录入页面点击'运行分析'按钮"
        action={{
          label: '去运行分析',
          onClick: () => {
            runEfficiencyCalculation();
          },
        }}
      />
    );
  }

  const { optimalOperatingPoint, efficientRange } = exp.efficiencyResult;
  const thrustUnit = exp.fittingParams.thrustUnit;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100 flex items-center gap-3">
            <Gauge className="text-alert-green" size={28} />
            效率曲线分析
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            推进效率 η = (推力功率 / 输入功率) × 100% | 数据点: {filteredPoints.length} 个
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runEfficiencyCalculation()}
            className="flex items-center gap-2 px-4 py-2 border border-industrial-600 rounded-lg text-gray-300 hover:bg-industrial-800 transition-colors"
          >
            <RefreshCw size={16} />
            <span className="text-sm font-medium">重新计算</span>
          </button>
          <button
            onClick={() => setShowSteps(!showSteps)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showSteps
                ? 'bg-tech-500/10 border-tech-500/30 text-tech-400'
                : 'border-industrial-600 text-gray-300 hover:bg-industrial-800'
            }`}
          >
            <Activity size={16} />
            <span className="text-sm font-medium">计算过程</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">最高效率</p>
          <p className="text-2xl font-bold font-mono text-alert-green">{optimalOperatingPoint.efficiency.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">@ {optimalOperatingPoint.rpm} RPM</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">最佳工作点推力</p>
          <p className="text-2xl font-bold font-mono text-tech-400">{optimalOperatingPoint.thrust.toFixed(4)}</p>
          <p className="text-xs text-gray-500 mt-1">{thrustUnit}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">最佳工作点功率</p>
          <p className="text-2xl font-bold font-mono text-amber-400">{optimalOperatingPoint.power.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">W</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">高效区间</p>
          <p className="text-xl font-bold font-mono text-gray-100">
            {efficientRange.minRpm} - {efficientRange.maxRpm}
          </p>
          <p className="text-xs text-gray-500 mt-1">RPM (≥{efficientRange.minEfficiency.toFixed(0)}%)</p>
        </div>
      </div>

      {showSteps && (
        <CalculationSteps steps={exp.efficiencyResult.calculationSteps} title="效率计算过程" />
      )}

      <div className="bg-gradient-to-r from-alert-green/10 to-tech-500/10 border border-alert-green/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-alert-green/20 rounded-lg">
            <Target className="text-alert-green" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-gray-100 mb-2">最佳工作点推荐</h3>
            <p className="text-sm text-gray-300 mb-4">
              基于效率曲线分析，推荐在 <span className="text-alert-green font-mono font-bold">{optimalOperatingPoint.rpm} RPM</span> 转速下工作，
              此时推进效率达到最高 <span className="text-alert-green font-mono font-bold">{optimalOperatingPoint.efficiency.toFixed(2)}%</span>。
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-industrial-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">转速</p>
                <p className="text-lg font-mono text-gray-100">{optimalOperatingPoint.rpm} RPM</p>
              </div>
              <div className="bg-industrial-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">推力</p>
                <p className="text-lg font-mono text-gray-100">{optimalOperatingPoint.thrust.toFixed(4)} {thrustUnit}</p>
              </div>
              <div className="bg-industrial-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">功率消耗</p>
                <p className="text-lg font-mono text-gray-100">{optimalOperatingPoint.power.toFixed(2)} W</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChartCard
        title="效率曲线"
        subtitle="转速 vs 推进效率 & 推力"
        option={efficiencyChartOption}
        height={380}
      />

      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="功率分析"
          subtitle="输入功率 vs 推力功率"
          option={powerChartOption}
          height={320}
        />
        <ChartCard
          title="功率-推力曲线"
          subtitle="输入功率 vs 推力输出"
          option={thrustPowerChartOption}
          height={320}
        />
      </div>

      <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
        <h3 className="font-display text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <Zap size={20} className="text-amber-400" />
          效率计算公式
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-industrial-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">推进效率</h4>
            <div className="bg-industrial-950 rounded p-3 font-mono text-sm text-tech-400">
              η = (T × v<sub>i</sub>) / (V × I) × 100%
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <p>• T: 推力 (N)</p>
              <p>• v<sub>i</sub>: 诱导速度 (m/s)</p>
              <p>• V: 电压 (V)</p>
              <p>• I: 电流 (A)</p>
            </div>
          </div>
          <div className="bg-industrial-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">诱导速度</h4>
            <div className="bg-industrial-950 rounded p-3 font-mono text-sm text-alert-green">
              v<sub>i</sub> = √(2T / (ρ × A))
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <p>• T: 推力 (N)</p>
              <p>• ρ: 空气密度 ({exp.environment.airDensity} kg/m³)</p>
              <p>• A: 桨盘面积 (m²)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
        <h3 className="font-display text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-tech-400" />
          效率数据详情
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-industrial-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">转速 (RPM)</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">输入功率 (W)</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">推力 ({thrustUnit})</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">推力功率 (W)</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">效率 (%)</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {exp.efficiencyResult.efficiencyCurve.map((point, index) => {
                const isOptimal = point.rpm === optimalOperatingPoint.rpm;
                const isEfficient = point.rpm >= efficientRange.minRpm && point.rpm <= efficientRange.maxRpm;
                return (
                  <tr
                    key={index}
                    className={`border-b border-industrial-800 ${isOptimal ? 'bg-alert-green/10' : ''} hover:bg-industrial-700/30`}
                  >
                    <td className="py-3 px-4 text-gray-500 font-mono">{index + 1}</td>
                    <td className="py-3 px-4 text-gray-100 font-mono">{point.rpm}</td>
                    <td className="py-3 px-4 text-right text-gray-100 font-mono">{point.power.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-gray-100 font-mono">{point.thrust.toFixed(4)}</td>
                    <td className="py-3 px-4 text-right text-gray-100 font-mono">{point.thrustPower.toFixed(4)}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={`font-bold ${
                        point.efficiency >= efficientRange.minEfficiency ? 'text-alert-green' : 'text-gray-400'
                      }`}>
                        {point.efficiency.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOptimal ? (
                        <span className="px-2 py-1 bg-alert-green/20 text-alert-green text-xs rounded-full">最佳</span>
                      ) : isEfficient ? (
                        <span className="px-2 py-1 bg-tech-500/20 text-tech-400 text-xs rounded-full">高效</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-full">一般</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
