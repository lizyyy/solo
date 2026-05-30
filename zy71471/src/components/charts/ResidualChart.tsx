import ReactECharts from 'echarts-for-react';
import type { SamplePoint } from '@/types';
import { useMemo } from 'react';

interface ResidualChartProps {
  points: SamplePoint[];
  rmse: number;
}

export const ResidualChart = ({ points, rmse }: ResidualChartProps) => {
  const option = useMemo(() => {
    const sigmaThreshold = 2 * rmse;

    const barData = points.map((p) => ({
      value: [p.sequence, p.residual ?? 0, p],
      itemStyle: {
        color:
          Math.abs(p.residual ?? 0) > sigmaThreshold ? '#ef4444' : '#60a5fa',
      },
    }));

    return {
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#334155', fontSize: 13 },
        formatter: (params: { data: { value: [number, number, SamplePoint] } }) => {
          const point = params.data.value[2];
          const residual = point.residual !== null ? point.residual.toFixed(6) : '-';
          const isOutlier = Math.abs(point.residual ?? 0) > sigmaThreshold;
          return `
            <div class="font-semibold text-slate-800 mb-2">#${point.sequence} 采样点</div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between gap-4"><span class="text-slate-500">残差:</span><span class="${isOutlier ? 'text-red-500' : 'text-slate-800'}">${residual} V</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-500">±2σ阈值:</span><span class="text-slate-800">±${sigmaThreshold.toFixed(6)} V</span></div>
              ${isOutlier ? '<div class="text-red-500 font-medium mt-2">⚠ 超过阈值</div>' : ''}
            </div>
          `;
        },
      },
      grid: { left: 60, right: 20, top: 30, bottom: 50 },
      xAxis: {
        type: 'category',
        name: '采样序号',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#64748b', fontSize: 13 },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 11, interval: Math.floor(points.length / 10) },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '残差 (V)',
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: { color: '#64748b', fontSize: 13 },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      },
      series: [
        {
          type: 'bar',
          data: barData,
          barWidth: '60%',
          animationDelay: (dataIndex: number) => dataIndex * 3,
          markLine: {
            symbol: 'none',
            lineStyle: { type: 'dashed', color: '#94a3b8', width: 1.5 },
            label: { formatter: '0', position: 'end', color: '#64748b', fontSize: 11 },
            data: [{ yAxis: 0 }],
            animation: false,
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(239, 68, 68, 0.08)' },
            data: [
              [{ yAxis: sigmaThreshold }, { yAxis: 'max' }],
              [{ yAxis: 'min' }, { yAxis: -sigmaThreshold }],
            ],
          },
        },
      ],
    };
  }, [points, rmse]);

  return (
    <div className="w-full h-full min-h-[250px] bg-white rounded-xl border border-slate-200 p-4">
      <ReactECharts
        option={option}
        style={{ height: '100%', minHeight: '250px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};
