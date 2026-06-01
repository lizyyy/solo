import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import type { FittingResult, ProcessedData, FittingPoint } from '../../types';
import { getStatusColor } from '../../utils/format';

interface FittingChartProps {
  fittingResult: FittingResult;
  processedData: ProcessedData[];
  onPointClick: (dataId: string) => void;
  highlightId?: string;
}

const FittingChart: React.FC<FittingChartProps> = ({ 
  fittingResult, 
  processedData, 
  onPointClick,
  highlightId 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !fittingResult.points.length) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const getDataPointColor = (point: FittingPoint) => {
      const data = processedData.find(d => d.id === point.dataId);
      if (!data) return '#43a047';
      if (data.id === highlightId) return '#ff7043';
      return getStatusColor(data.status);
    };

    const getDataPointSymbolSize = (point: FittingPoint) => {
      const data = processedData.find(d => d.id === point.dataId);
      if (!data) return 8;
      if (data.id === highlightId) return 14;
      if (data.isAnomaly) return 12;
      if (data.status === 'historical') return 10;
      return 8;
    };

    const getPointTooltip = (point: FittingPoint) => {
      const data = processedData.find(d => d.id === point.dataId);
      if (!data) return '';
      const issues: string[] = [];
      if (data.isNull) issues.push('空值');
      if (data.isDuplicate) issues.push('重复');
      if (data.isAnomaly) issues.push('异常');
      if (data.stressUnit !== data.targetStressUnit || data.lifeUnit !== data.targetLifeUnit) issues.push('单位换算');
      
      return `
        <div style="font-family: 'Noto Sans SC', sans-serif; min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: #1e3a5f;">${data.id}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px;">
            <div style="color: #627d98;">材料:</div>
            <div style="font-weight: 500;">${data.material}</div>
            <div style="color: #627d98;">应力:</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 500;">${point.stress.toFixed(1)} MPa</div>
            <div style="color: #627d98;">实测寿命:</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 500;">${point.life.toExponential(2)} 次</div>
            <div style="color: #627d98;">预测寿命:</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 500;">${point.predictedLife.toExponential(2)} 次</div>
            <div style="color: #627d98;">残差:</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 500; color: ${Math.abs(point.residual) > point.life * 0.2 ? '#e53935' : '#43a047'}">${point.residual.toExponential(2)}</div>
          </div>
          ${issues.length > 0 ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #d9e2ec;">
              <div style="color: #ff7043; font-size: 11px;">⚠️ ${issues.join('、')}</div>
            </div>
          ` : ''}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #d9e2ec; color: #627d98; font-size: 11px;">
            点击查看完整溯源明细
          </div>
        </div>
      `;
    };

    const sortedStress = [...fittingResult.points].sort((a, b) => a.stress - b.stress);
    const minStress = sortedStress[0]?.stress || 500;
    const maxStress = sortedStress[sortedStress.length - 1]?.stress || 1000;
    const linePoints = Array.from({ length: 100 }, (_, i) => {
      const stress = minStress + (maxStress - minStress) * (i / 99);
      let predictedLife = 0;
      
      if (fittingResult.model === 'power') {
        predictedLife = fittingResult.parameters.a * Math.pow(stress, -fittingResult.parameters.b);
      } else if (fittingResult.model === 'exponential') {
        predictedLife = fittingResult.parameters.a * Math.exp(fittingResult.parameters.b * stress);
      } else if (fittingResult.model === 'basquin') {
        predictedLife = Math.pow(10, (Math.log10(stress) - Math.log10(fittingResult.parameters.a)) / fittingResult.parameters.b) / 2;
      }
      
      return [stress, predictedLife];
    });

    const option: EChartsOption = {
      backgroundColor: '#fff',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#1e3a5f',
        borderWidth: 1,
        padding: 12,
        formatter: (params: any) => {
          if (params.seriesName === '试验数据点') {
            const point = fittingResult.points[params.dataIndex];
            return getPointTooltip(point);
          }
          return `${params.seriesName}<br/>${params.marker} ${params.value[0].toFixed(1)} MPa, ${params.value[1].toExponential(2)} 次`;
        },
      },
      legend: {
        data: ['试验数据点', '拟合曲线', '95%置信区间'],
        top: 10,
        right: 20,
        textStyle: {
          fontFamily: 'Noto Sans SC',
          fontSize: 12,
          color: '#486581',
        },
      },
      grid: {
        left: 70,
        right: 30,
        top: 60,
        bottom: 60,
      },
      xAxis: {
        type: 'value',
        name: '应力 (MPa)',
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: {
          fontFamily: 'Noto Serif SC',
          fontSize: 13,
          fontWeight: 600,
          color: '#1e3a5f',
        },
        axisLabel: {
          fontFamily: 'JetBrains Mono',
          fontSize: 11,
          color: '#627d98',
        },
        axisLine: {
          lineStyle: { color: '#9fb3c8' },
        },
        splitLine: {
          lineStyle: { color: '#d9e2ec', type: 'dashed' },
        },
      },
      yAxis: {
        type: 'log',
        name: '疲劳寿命 (次)',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          fontFamily: 'Noto Serif SC',
          fontSize: 13,
          fontWeight: 600,
          color: '#1e3a5f',
        },
        axisLabel: {
          fontFamily: 'JetBrains Mono',
          fontSize: 11,
          color: '#627d98',
          formatter: (value: number) => value.toExponential(0),
        },
        axisLine: {
          lineStyle: { color: '#9fb3c8' },
        },
        splitLine: {
          lineStyle: { color: '#d9e2ec', type: 'dashed' },
        },
        minorSplitLine: {
          show: true,
          lineStyle: { color: '#f0f4f8', type: 'dashed' },
        },
      },
      series: [
        {
          name: '拟合曲线',
          type: 'line',
          data: linePoints,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#1e3a5f',
            width: 3,
          },
          z: 2,
        },
        {
          name: '试验数据点',
          type: 'scatter',
          data: fittingResult.points.map((point, index) => ({
            value: [point.stress, point.life],
            itemStyle: {
              color: getDataPointColor(point),
              borderColor: point.dataId === highlightId ? '#1e3a5f' : '#fff',
              borderWidth: point.dataId === highlightId ? 3 : 2,
            },
            symbolSize: getDataPointSymbolSize(point),
          })),
          emphasis: {
            itemStyle: {
              borderWidth: 3,
              borderColor: '#1e3a5f',
              shadowBlur: 10,
              shadowColor: 'rgba(30, 58, 95, 0.3)',
            },
          },
          z: 3,
        },
      ],
    };

    chartInstance.current.setOption(option);

    chartInstance.current.off('click');
    chartInstance.current.on('click', (params: any) => {
      if (params.seriesName === '试验数据点') {
        const point = fittingResult.points[params.dataIndex];
        onPointClick(point.dataId);
      }
    });

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [fittingResult, processedData, highlightId, onPointClick]);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          S-N 疲劳寿命拟合曲线
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-engineering-500">
            模型：<span className="font-semibold text-engineering-800">
              {fittingResult.model === 'power' ? '幂函数' : 
               fittingResult.model === 'exponential' ? '指数函数' : 'Basquin'}
            </span>
          </span>
          <span className="text-engineering-500">
            R²：<span className="font-mono-num font-semibold text-success-700">
              {fittingResult.parameters.r2.toFixed(4)}
            </span>
          </span>
        </div>
      </div>
      <div className="card-body p-2">
        <div ref={chartRef} className="w-full h-[500px]" />
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-4 text-xs text-engineering-500 mt-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-success-500" /> 正常数据
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-warning-500" /> 待确认
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-danger-500" /> 异常值
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-historical-500" /> 历史数据
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-1 bg-engineering-800" /> 拟合曲线
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FittingChart;
