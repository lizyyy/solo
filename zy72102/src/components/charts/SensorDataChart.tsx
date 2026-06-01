import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { SensorData, Anomaly } from '../../types';
import { formatTime } from '../../utils/formatters';

interface SensorDataChartProps {
  sensorData: SensorData[];
  anomalies?: Anomaly[];
  height?: number;
  highlightedIndex?: number | null;
}

export function SensorDataChart({
  sensorData,
  anomalies = [],
  height = 300,
  highlightedIndex,
}: SensorDataChartProps) {
  const option = useMemo(() => {
    const timestamps = sensorData.map((d) => d.timestamp);
    const tempData = sensorData.map((d) => [d.timestamp, d.temperature]);
    const vibrationData = sensorData.map((d) => [d.timestamp, d.vibration]);

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
            const unit = i.seriesName.includes('温度') ? '°C' : 'mm/s';
            result += `<div class="flex items-center justify-between gap-4">
              <span>${i.seriesName}</span>
              <span class="font-mono">${i.value[1].toFixed(2)} ${unit}</span>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        data: ['温度', '振动'],
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
      yAxis: [
        {
          type: 'value',
          name: '温度 (°C)',
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
        {
          type: 'value',
          name: '振动 (mm/s)',
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
            show: false,
          },
        },
      ],
      series: [
        {
          name: '温度',
          type: 'line',
          smooth: true,
          showSymbol: highlightedIndex !== null,
          symbolSize: highlightedIndex !== null ? 8 : 0,
          data: tempData.map((d, i) => ({
            value: d,
            itemStyle:
              highlightedIndex === i
                ? { color: '#ff7a45', borderColor: '#fff', borderWidth: 2 }
                : undefined,
          })),
          lineStyle: {
            color: '#ff7a45',
            width: 2,
          },
          markLine: {
            silent: true,
            lineStyle: {
              color: '#ef4444',
              type: 'dashed',
              width: 1,
            },
            data: [
              {
                yAxis: 71.5,
                label: {
                  formatter: '温度上限',
                  color: '#ef4444',
                  fontSize: 10,
                },
              },
            ],
          },
        },
        {
          name: '振动',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          showSymbol: false,
          data: vibrationData,
          lineStyle: {
            color: '#22d3ee',
            width: 2,
          },
          markLine: {
            silent: true,
            lineStyle: {
              color: '#ef4444',
              type: 'dashed',
              width: 1,
            },
            data: [
              {
                yAxis: 10,
                label: {
                  formatter: '振动阈值',
                  color: '#ef4444',
                  fontSize: 10,
                },
              },
            ],
          },
        },
      ],
    };
  }, [sensorData, highlightedIndex]);

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
