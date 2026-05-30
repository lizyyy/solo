import ReactECharts from 'echarts-for-react';
import type { SamplePoint, TheoryPoint, FitMode, TimeUnit } from '@/types';
import { useMemo } from 'react';

interface FitChartProps {
  points: SamplePoint[];
  theoryCurve: TheoryPoint[];
  fitMode: FitMode;
  showOutliers: boolean;
  timeUnit: TimeUnit;
  confidenceInterval?: {
    lower: number[];
    upper: number[];
  };
}

export const FitChart = ({
  points,
  theoryCurve,
  fitMode,
  showOutliers,
  timeUnit,
  confidenceInterval,
}: FitChartProps) => {
  const option = useMemo(() => {
    const normalPoints = points.filter((p) => !p.isOutlier);
    const outlierPoints = points.filter((p) => p.isOutlier);

    const scatterData = normalPoints.map((p) => [p.time, p.voltage, p]);
    const outlierData = outlierPoints.map((p) => [p.time, p.voltage, p]);
    const curveData = theoryCurve.map((p) => [p.time, p.voltage]);

    const ciData =
      confidenceInterval &&
      theoryCurve.map((p, i) => [
        p.time,
        confidenceInterval.lower[i],
        confidenceInterval.upper[i],
      ]);

    const yAxisLabel = fitMode === 'charge' ? '充电电压 (V)' : '放电电压 (V)';

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
        formatter: (params: { data: [number, number, SamplePoint] }) => {
          const point = params.data[2];
          if (!point) return '';
          const residual = point.residual !== null ? point.residual.toFixed(4) : '-';
          const residualClass = Number(residual) > 0.1 ? 'text-red-500' : 'text-slate-800';
          return `
            <div class="font-semibold text-slate-800 mb-2">#${point.sequence} 采样点</div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between gap-4"><span class="text-slate-500">时间:</span><span class="text-slate-800">${point.time} ${timeUnit}</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-500">电压:</span><span class="text-slate-800">${point.voltage.toFixed(4)} V</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-500">残差:</span><span class="${residualClass}">${residual} V</span></div>
              ${point.isOutlier ? '<div class="text-red-500 font-medium mt-2">⚠ 异常点</div>' : ''}
            </div>
          `;
        },
      },
      legend: {
        data: ['实验数据', '理论拟合曲线', '95%置信区间', ...(showOutliers ? ['异常点'] : [])],
        top: 0,
        right: 0,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: '#64748b', fontSize: 12 },
      },
      grid: { left: 60, right: 20, top: 50, bottom: 50 },
      xAxis: {
        type: 'value',
        name: `时间 (${timeUnit})`,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#64748b', fontSize: 13 },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: { color: '#64748b', fontSize: 13 },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      },
      series: [
        {
          name: '95%置信区间',
          type: 'line',
          data: ciData,
          lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgba(249, 115, 22, 0.15)' },
          symbol: 'none',
          z: 1,
          silent: true,
        },
        {
          name: '理论拟合曲线',
          type: 'line',
          data: curveData,
          smooth: true,
          lineStyle: { color: '#f97316', width: 2.5 },
          symbol: 'none',
          z: 3,
          animationDelay: 300,
        },
        {
          name: '实验数据',
          type: 'scatter',
          data: scatterData,
          symbolSize: 8,
          itemStyle: { color: '#3b82f6', borderWidth: 1, borderColor: '#fff' },
          emphasis: {
            itemStyle: {
              color: '#2563eb',
              borderWidth: 2,
              borderColor: '#fff',
              shadowBlur: 10,
              shadowColor: 'rgba(59, 130, 246, 0.5)',
            },
          },
          z: 5,
          animationDelay: (dataIndex: number) => dataIndex * 2,
        },
        ...(showOutliers
          ? [
              {
                name: '异常点',
                type: 'scatter',
                data: outlierData,
                symbolSize: 10,
                itemStyle: { color: '#ef4444', borderWidth: 1, borderColor: '#fff' },
                emphasis: {
                  itemStyle: {
                    color: '#dc2626',
                    borderWidth: 2,
                    borderColor: '#fff',
                    shadowBlur: 10,
                    shadowColor: 'rgba(239, 68, 68, 0.5)',
                  },
                },
                z: 6,
              },
            ]
          : []),
      ],
    };
  }, [points, theoryCurve, fitMode, showOutliers, timeUnit, confidenceInterval]);

  return (
    <div className="w-full h-full min-h-[300px] bg-white rounded-xl border border-slate-200 p-4">
      <ReactECharts
        option={option}
        style={{ height: '100%', minHeight: '300px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};
