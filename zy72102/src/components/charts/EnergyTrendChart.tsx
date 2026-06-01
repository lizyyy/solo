import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EnergyPoint, Anomaly } from '../../types';
import { formatTime } from '../../utils/formatters';

interface EnergyTrendChartProps {
  kineticEnergy: EnergyPoint[];
  potentialEnergy: EnergyPoint[];
  totalEnergy: EnergyPoint[];
  anomalies?: Anomaly[];
  height?: number;
  highlightedIndex?: number | null;
}

export function EnergyTrendChart({
  kineticEnergy,
  potentialEnergy,
  totalEnergy,
  anomalies = [],
  height = 400,
  highlightedIndex,
}: EnergyTrendChartProps) {
  const option = useMemo(() => {
    const timestamps = totalEnergy.map((p) => p.timestamp);
    const kineticData = kineticEnergy.map((p) => [p.timestamp, p.value / 1000]);
    const potentialData = potentialEnergy.map((p) => [p.timestamp, p.value / 1000]);
    const totalData = totalEnergy.map((p) => [p.timestamp, p.value / 1000]);

    const anomalyMarkPoints = anomalies
      .filter((a) => a.type === 'energy')
      .map((a) => ({
        name: '能量异常',
        xAxis: a.timestamp,
        yAxis: totalEnergy[a.dataIndex]?.value / 1000 || 0,
        itemStyle: {
          color: a.severity === 'critical' ? '#ef4444' : '#ff7a45',
        },
        label: {
          show: false,
        },
      }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: {
          color: '#e2e8f0',
        },
        formatter: (params: unknown[]) => {
          const p = params[0] as { axisValue: number };
          if (!p) return '';
          const time = formatTime(p.axisValue);
          let result = `<div class="font-medium mb-1">${time}</div>`;
          params.forEach((item: unknown) => {
            const i = item as { seriesName: string; value: [number, number] };
            result += `<div class="flex items-center justify-between gap-4">
              <span>${i.seriesName}</span>
              <span class="font-mono">${i.value[1].toFixed(2)} kJ</span>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        data: ['动能', '势能', '总能量'],
        textStyle: {
          color: '#94a3b8',
        },
        top: 10,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 50,
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        axisLine: {
          lineStyle: {
            color: '#334155',
          },
        },
        axisLabel: {
          color: '#64748b',
          formatter: (value: number) => formatTime(value),
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: '能量 (kJ)',
        nameTextStyle: {
          color: '#64748b',
        },
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#64748b',
        },
        splitLine: {
          lineStyle: {
            color: '#1e293b',
          },
        },
      },
      series: [
        {
          name: '动能',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: kineticData,
          lineStyle: {
            color: '#22d3ee',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34, 211, 238, 0.3)' },
                { offset: 1, color: 'rgba(34, 211, 238, 0)' },
              ],
            },
          },
        },
        {
          name: '势能',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: potentialData,
          lineStyle: {
            color: '#a78bfa',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(167, 139, 250, 0.3)' },
                { offset: 1, color: 'rgba(167, 139, 250, 0)' },
              ],
            },
          },
        },
        {
          name: '总能量',
          type: 'line',
          smooth: true,
          showSymbol: highlightedIndex !== null,
          symbolSize: highlightedIndex !== null ? 10 : 0,
          data: totalData.map((d, i) => ({
            value: d,
            itemStyle:
              highlightedIndex === i
                ? { color: '#ff7a45', borderColor: '#fff', borderWidth: 2 }
                : undefined,
          })),
          lineStyle: {
            color: '#3b82f6',
            width: 3,
          },
          markPoint: {
            data: anomalyMarkPoints,
            symbolSize: 8,
          },
        },
      ],
    };
  }, [kineticEnergy, potentialEnergy, totalEnergy, anomalies, highlightedIndex]);

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
