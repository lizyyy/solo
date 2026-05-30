import ReactECharts from 'echarts-for-react';
import type { ParameterImpact } from '@/types';
import { useMemo } from 'react';

interface ParameterImpactChartProps {
  impacts: ParameterImpact[];
}

export const ParameterImpactChart = ({ impacts }: ParameterImpactChartProps) => {
  const option = useMemo(() => {
    const maxImpact = Math.max(...impacts.map((i) => i.impact), 1);

    const getColor = (value: number) => {
      const ratio = value / maxImpact;
      const r = Math.round(34 + ratio * 205);
      const g = Math.round(197 - ratio * 143);
      const b = Math.round(94 - ratio * 62);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const data = impacts
      .sort((a, b) => a.impact - b.impact)
      .map((item) => ({
        value: item.impact,
        name: item.label,
        itemStyle: { color: getColor(item.impact) },
        unit: item.unit,
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
        formatter: (params: { data: { name: string; value: number; unit: string } }) => {
          const { name, value, unit } = params.data;
          const percentage = ((value / maxImpact) * 100).toFixed(1);
          return `
            <div class="font-semibold text-slate-800 mb-2">${name}</div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between gap-4"><span class="text-slate-500">影响度:</span><span class="text-slate-800">${value.toFixed(4)} ${unit}</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-500">相对占比:</span><span class="text-slate-800">${percentage}%</span></div>
            </div>
          `;
        },
      },
      grid: { left: 80, right: 40, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        name: '影响度',
        nameLocation: 'end',
        nameGap: 15,
        nameTextStyle: { color: '#64748b', fontSize: 12 },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.name),
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 12 },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: data,
          barWidth: '50%',
          label: {
            show: true,
            position: 'right',
            color: '#64748b',
            fontSize: 11,
            formatter: (params: { data: { value: number; unit: string } }) => {
              return `${params.data.value.toFixed(3)} ${params.data.unit}`;
            },
          },
          animationDelay: (dataIndex: number) => dataIndex * 150,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
        },
      ],
    };
  }, [impacts]);

  return (
    <div className="w-full h-full min-h-[200px] bg-white rounded-xl border border-slate-200 p-4">
      <ReactECharts
        option={option}
        style={{ height: '100%', minHeight: '200px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};
