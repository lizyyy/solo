import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ECharts } from 'echarts';
import type { TemperaturePoint } from '../../types';

interface TemperatureCurveProps {
  temperatureCurve: TemperaturePoint[];
  onChartReady?: (chart: ECharts) => void;
}

export const TemperatureCurve = ({ temperatureCurve, onChartReady }: TemperatureCurveProps) => {
  const chartRef = useRef<ReactECharts>(null);

  const chartOption = useMemo(() => {
    if (!temperatureCurve || temperatureCurve.length === 0) {
      return {};
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ seriesName: string; value: [number, number] }>) => {
          const layer = params[0].value[0];
          let html = `<div style="font-family: monospace; padding: 8px;"><strong>第 ${layer} 层</strong><br/>`;
          params.forEach((p) => {
            const color = p.seriesName === '喷嘴' ? '#F53F3F' : p.seriesName === '床温' ? '#FF7D00' : '#165DFF';
            html += `<span style="color: ${color}">${p.seriesName}: ${p.value[1].toFixed(1)}°C</span><br/>`;
          });
          html += '</div>';
          return html;
        },
      },
      legend: {
        data: ['喷嘴', '床温', '环境'],
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
      grid: {
        left: 50,
        right: 30,
        top: 40,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        name: '打印层数',
        nameTextStyle: { color: '#64748b' },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'value',
        name: '温度 (°C)',
        nameTextStyle: { color: '#64748b' },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [
        {
          name: '喷嘴',
          type: 'line',
          data: temperatureCurve.map((p) => [p.layer, p.nozzle]),
          smooth: true,
          lineStyle: { color: '#F53F3F', width: 2 },
          itemStyle: { color: '#F53F3F' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 63, 63, 0.3)' },
                { offset: 1, color: 'rgba(245, 63, 63, 0)' },
              ],
            },
          },
        },
        {
          name: '床温',
          type: 'line',
          data: temperatureCurve.map((p) => [p.layer, p.bed]),
          smooth: true,
          lineStyle: { color: '#FF7D00', width: 2 },
          itemStyle: { color: '#FF7D00' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(255, 125, 0, 0.3)' },
                { offset: 1, color: 'rgba(255, 125, 0, 0)' },
              ],
            },
          },
        },
        {
          name: '环境',
          type: 'line',
          data: temperatureCurve.map((p) => [p.layer, p.ambient]),
          smooth: true,
          lineStyle: { color: '#165DFF', width: 2, type: 'dashed' },
          itemStyle: { color: '#165DFF' },
        },
      ],
    };
  }, [temperatureCurve]);

  if (!temperatureCurve || temperatureCurve.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-800/30 rounded-lg border border-slate-700 border-dashed">
        <div className="text-gray-500 text-center">
          <div className="text-4xl mb-2">🌡️</div>
          <div>暂无温度数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <h4 className="text-sm font-medium text-gray-300 mb-2">温度梯度曲线</h4>
      <ReactECharts
        ref={chartRef}
        option={chartOption}
        style={{ height: '240px' }}
        onChartReady={(chart) => onChartReady?.(chart)}
        notMerge
      />
    </div>
  );
};
