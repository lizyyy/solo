import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp, RefreshCw, AlertTriangle, BarChart3, Activity } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { ChartCard } from '@/components/ChartCard';
import { CalculationSteps } from '@/components/CalculationSteps';
import Empty from '@/components/Empty';
import type { EChartsOption } from 'echarts';

export const ThrustFitting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showSteps, setShowSteps] = useState(false);

  const {
    experiments,
    loadExperiment,
    runFitting,
    getCurrentExperiment,
    getFilteredDataPoints,
    updateFittingParams,
    filterConditions,
    updateFilterConditions,
  } = useExperimentStore();

  useEffect(() => {
    if (id && !experiments.some(e => e.id === id)) {
      loadExperiment(id);
    }
  }, [id, experiments, loadExperiment]);

  const exp = getCurrentExperiment();
  const filteredPoints = getFilteredDataPoints();

  const variableLabels: Record<string, string> = {
    rpm: '转速 (RPM)',
    voltage: '电压 (V)',
    propellerDiameter: '桨径 (inch)',
  };

  const fittingChartOption = useMemo<EChartsOption>(() => {
    if (!exp?.fittingResult || filteredPoints.length === 0) return {};

    const { independentVariable } = exp.fittingParams;
    const { formula, rSquared } = exp.fittingResult;

    const xData = filteredPoints.map(p => p[independentVariable as keyof typeof p] as number);
    const yData = filteredPoints.map(p => p.thrust);

    const anomalyPointIds = new Set(exp.anomalies.map(a => a.dataPointId));
    const normalIndices: number[] = [];
    const anomalyIndices: number[] = [];

    filteredPoints.forEach((p, i) => {
      if (anomalyPointIds.has(p.id)) {
        anomalyIndices.push(i);
      } else {
        normalIndices.push(i);
      }
    });

    const minX = Math.min(...xData);
    const maxX = Math.max(...xData);
    const curvePoints = Array.from({ length: 100 }, (_, i) => {
      const x = minX + (maxX - minX) * (i / 99);
      let y = 0;
      const coeffs = exp.fittingResult!.coefficients;
      if (exp.fittingParams.fitType === 'power') {
        y = coeffs[0] * Math.pow(x, coeffs[1]);
      } else {
        for (let j = 0; j < coeffs.length; j++) {
          y += coeffs[j] * Math.pow(x, coeffs.length - 1 - j);
        }
      }
      return [x, y];
    });

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const point = filteredPoints[params[0]?.dataIndex];
          if (!point) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">数据点 #${params[0].dataIndex + 1}</div>
              <div>${variableLabels[independentVariable]}: ${point[independentVariable as keyof typeof point]}</div>
              <div>推力: ${point.thrust} ${exp.fittingParams.thrustUnit}</div>
              <div>电压: ${point.voltage} V</div>
              <div>电流: ${point.current} A</div>
            </div>
          `;
        },
      },
      grid: { left: '10%', right: '5%', top: '15%', bottom: '15%' },
      xAxis: {
        type: 'value',
        name: variableLabels[independentVariable],
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: `推力 (${exp.fittingParams.thrustUnit})`,
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      series: [
        {
          name: '正常数据',
          type: 'scatter',
          data: normalIndices.map(i => [xData[i], yData[i]]),
          symbolSize: 10,
          itemStyle: { color: '#06b6d4', borderColor: '#0891b2', borderWidth: 1 },
          emphasis: { itemStyle: { color: '#22d3ee', borderWidth: 2 } },
        },
        {
          name: '异常数据',
          type: 'scatter',
          data: anomalyIndices.map(i => [xData[i], yData[i]]),
          symbolSize: 12,
          itemStyle: { color: '#f97316', borderColor: '#ea580c', borderWidth: 2 },
          emphasis: { itemStyle: { color: '#fb923c' } },
        },
        {
          name: '拟合曲线',
          type: 'line',
          data: curvePoints,
          smooth: true,
          lineStyle: { color: '#10b981', width: 2 },
          itemStyle: { color: 'transparent' },
          tooltip: {
            formatter: (params: any) => {
              return `
                <div style="padding: 8px;">
                  <div style="font-weight: bold; color: #10b981; margin-bottom: 4px;">拟合曲线</div>
                  <div>${variableLabels[independentVariable]}: ${params.data[0].toFixed(2)}</div>
                  <div>预测推力: ${params.data[1].toFixed(4)} ${exp.fittingParams.thrustUnit}</div>
                </div>
              `;
            },
          },
        },
      ],
      legend: {
        data: ['正常数据', '异常数据', '拟合曲线'],
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          bottom: 10,
          style: {
            text: `R² = ${rSquared.toFixed(4)} | ${formula}`,
            fill: '#94a3b8',
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
          },
        },
      ],
    };
  }, [exp, filteredPoints, variableLabels]);

  const residualChartOption = useMemo<EChartsOption>(() => {
    if (!exp?.fittingResult) return {};

    const { residuals } = exp.fittingResult;
    const stdResiduals = residuals.map(r => r.standardizedResidual);
    const threshold = exp.fittingParams.outlierThreshold;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const r = residuals[params[0]?.dataIndex];
          if (!r) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">残差分析</div>
              <div>X值: ${r.x}</div>
              <div>观测值: ${r.observed.toFixed(4)}</div>
              <div>预测值: ${r.predicted.toFixed(4)}</div>
              <div>残差: ${r.residual.toFixed(4)}</div>
              <div>标准化残差: ${r.standardizedResidual.toFixed(4)}</div>
            </div>
          `;
        },
      },
      grid: { left: '10%', right: '5%', top: '10%', bottom: '15%' },
      xAxis: {
        type: 'category',
        data: residuals.map((_, i) => `#${i + 1}`),
        name: '数据点',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono', rotate: 45 },
      },
      yAxis: {
        type: 'value',
        name: '标准化残差',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      series: [
        {
          name: '标准化残差',
          type: 'bar',
          data: stdResiduals.map(r => ({
            value: r,
            itemStyle: {
              color: Math.abs(r) > threshold ? '#ef4444' : Math.abs(r) > threshold * 0.7 ? '#f97316' : '#06b6d4',
            },
          })),
          markLine: {
            silent: true,
            lineStyle: { color: '#ef4444', type: 'dashed' },
            data: [
              { yAxis: threshold, label: { formatter: `+${threshold}σ`, color: '#ef4444', fontFamily: 'JetBrains Mono' } },
              { yAxis: -threshold, label: { formatter: `-${threshold}σ`, color: '#ef4444', fontFamily: 'JetBrains Mono' } },
            ],
          },
        },
      ],
    };
  }, [exp]);

  const impactChartOption = useMemo<EChartsOption>(() => {
    if (!exp?.fittingResult) return {};

    const { impactFactors } = exp.fittingResult;
    const total = impactFactors.rpm + impactFactors.voltage + impactFactors.propellerDiameter;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const p = params[0];
          const value = p.data.value;
          const percent = ((value / total) * 100).toFixed(1);
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
              <div>影响权重: ${value.toFixed(4)}</div>
              <div>占比: ${percent}%</div>
            </div>
          `;
        },
      },
      grid: { left: '20%', right: '10%', top: '10%', bottom: '10%' },
      xAxis: {
        type: 'value',
        name: '影响权重',
        nameTextStyle: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: ['桨径', '电压', '转速'],
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'Space Grotesk' },
      },
      series: [
        {
          type: 'bar',
          data: [
            { value: impactFactors.propellerDiameter, itemStyle: { color: '#8b5cf6' } },
            { value: impactFactors.voltage, itemStyle: { color: '#10b981' } },
            { value: impactFactors.rpm, itemStyle: { color: '#06b6d4' } },
          ],
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${((params.data.value / total) * 100).toFixed(1)}%`,
            color: '#94a3b8',
            fontFamily: 'JetBrains Mono',
          },
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

  if (!exp.fittingResult) {
    return (
      <Empty
        icon={TrendingUp}
        title="尚无拟合结果"
        description="请先在数据录入页面点击'运行分析'按钮"
        action={{
          label: '去运行分析',
          onClick: () => {
            runFitting();
          },
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100 flex items-center gap-3">
            <TrendingUp className="text-tech-400" size={28} />
            推力拟合分析
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            自变量: {variableLabels[exp.fittingParams.independentVariable]} |
            拟合类型: {exp.fittingParams.fitType === 'linear' ? '线性' : exp.fittingParams.fitType === 'polynomial' ? `多项式 (${exp.fittingParams.polynomialDegree}次)` : '幂函数'} |
            数据点: {filteredPoints.length} 个
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runFitting()}
            className="flex items-center gap-2 px-4 py-2 border border-industrial-600 rounded-lg text-gray-300 hover:bg-industrial-800 transition-colors"
          >
            <RefreshCw size={16} />
            <span className="text-sm font-medium">重新拟合</span>
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
          <p className="text-xs text-gray-500 mb-1">拟合优度 R²</p>
          <p className="text-2xl font-bold font-mono text-tech-400">{exp.fittingResult.rSquared.toFixed(4)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {exp.fittingResult.rSquared >= 0.99 ? '优秀' : exp.fittingResult.rSquared >= 0.95 ? '良好' : exp.fittingResult.rSquared >= 0.9 ? '一般' : '较差'}
          </p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">调整后 R²</p>
          <p className="text-2xl font-bold font-mono text-alert-green">{exp.fittingResult.adjustedRSquared.toFixed(4)}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">置信区间 (95%)</p>
          <p className="text-2xl font-bold font-mono text-gray-100">±{exp.fittingResult.confidenceInterval.toFixed(4)}</p>
          <p className="text-xs text-gray-500 mt-1">{exp.fittingParams.thrustUnit}</p>
        </div>
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">拟合公式</p>
          <p className="text-lg font-bold font-mono text-tech-400 truncate" title={exp.fittingResult.formula}>
            {exp.fittingResult.formula}
          </p>
        </div>
      </div>

      {exp.anomalies.length > 0 && filterConditions.excludeAnomalies && (
        <div className="bg-alert-orange/10 border border-alert-orange/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="text-alert-orange flex-shrink-0" size={20} />
          <div>
            <p className="text-sm text-alert-orange font-medium">当前已排除 {exp.anomalies.length} 个异常数据点</p>
            <p className="text-xs text-gray-400 mt-0.5">可在参数配置中关闭异常点排除</p>
          </div>
          <button
            onClick={() => updateFilterConditions({ excludeAnomalies: false })}
            className="ml-auto px-3 py-1.5 bg-alert-orange/20 hover:bg-alert-orange/30 text-alert-orange text-xs rounded transition-colors"
          >
            包含异常点
          </button>
        </div>
      )}

      {showSteps && (
        <CalculationSteps steps={exp.fittingResult.calculationSteps} title="拟合计算过程" />
      )}

      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="推力拟合曲线"
          subtitle={`${variableLabels[exp.fittingParams.independentVariable]} vs 推力`}
          option={fittingChartOption}
          height={380}
        />
        <ChartCard
          title="残差分析"
          subtitle="标准化残差柱状图"
          option={residualChartOption}
          height={380}
        />
      </div>

      <ChartCard
        title="影响因子分析"
        subtitle="转速、电压、桨径对推力的影响权重"
        option={impactChartOption}
        height={300}
      />

      <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
        <h3 className="font-display text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-tech-400" />
          拟合参数详情
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">系数</h4>
            <div className="space-y-2">
              {exp.fittingResult.coefficients.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                  <span className="text-sm text-gray-400 font-mono">
                    {exp.fittingParams.fitType === 'power'
                      ? i === 0 ? 'a (系数)' : 'b (指数)'
                      : `x^${exp.fittingResult.coefficients.length - 1 - i}`}
                  </span>
                  <span className="text-sm font-mono text-gray-100">{c.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">统计指标</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                <span className="text-sm text-gray-400">样本数量</span>
                <span className="text-sm font-mono text-gray-100">{filteredPoints.length}</span>
              </div>
              <div className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                <span className="text-sm text-gray-400">自由度</span>
                <span className="text-sm font-mono text-gray-100">
                  {filteredPoints.length - exp.fittingResult.coefficients.length}
                </span>
              </div>
              <div className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                <span className="text-sm text-gray-400">残差平方和</span>
                <span className="text-sm font-mono text-gray-100">
                  {exp.fittingResult.residuals.reduce((sum, r) => sum + r.residual * r.residual, 0).toFixed(6)}
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">控制变量</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                <span className="text-sm text-gray-400">空气密度</span>
                <span className="text-sm font-mono text-gray-100">{exp.environment.airDensity} kg/m³</span>
              </div>
              <div className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                <span className="text-sm text-gray-400">温度</span>
                <span className="text-sm font-mono text-gray-100">{exp.environment.temperature} °C</span>
              </div>
              <div className="flex items-center justify-between bg-industrial-900 rounded px-3 py-2">
                <span className="text-sm text-gray-400">大气压</span>
                <span className="text-sm font-mono text-gray-100">{exp.environment.pressure} kPa</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
