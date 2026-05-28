import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { FrameSample } from '@/types';

interface FpsChartProps {
  data: FrameSample[];
  height?: number;
}

export default function FpsChart({ data, height = 200 }: FpsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    const times = data.map((d) => d.timestamp.toFixed(2));
    const fpsValues = data.map((d) => d.fps);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 18, 24, 0.95)',
        borderColor: 'rgba(78, 89, 105, 0.5)',
        textStyle: {
          color: '#e5e6eb',
        },
      },
      grid: {
        left: '3%',
        right: '3%',
        top: '10%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: {
          lineStyle: {
            color: '#4e5969',
          },
        },
        axisLabel: {
          color: '#86909c',
          formatter: (value: string) => `${parseFloat(value).toFixed(0)}s`,
          interval: Math.floor(data.length / 8),
        },
      },
      yAxis: {
        type: 'value',
        name: 'FPS',
        nameTextStyle: {
          color: '#86909c',
        },
        min: 0,
        max: 120,
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#86909c',
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(78, 89, 105, 0.3)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'FPS',
          type: 'line',
          data: fpsValues,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#ef4444' },
              { offset: 0.5, color: '#f59e0b' },
              { offset: 1, color: '#10b981' },
            ]),
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0)' },
            ]),
          },
          markLine: {
            silent: true,
            data: [
              {
                yAxis: 60,
                lineStyle: {
                  color: 'rgba(245, 158, 11, 0.5)',
                  type: 'dashed',
                },
                label: {
                  formatter: '目标帧率',
                  color: '#f59e0b',
                  fontSize: 10,
                },
              },
            ],
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  return (
    <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-white text-sm">帧率监控</h3>
        <span className="text-xs text-dark-400">
          平均: {Math.round(data.reduce((a, b) => a + b.fps, 0) / data.length)} FPS
        </span>
      </div>
      <div ref={chartRef} style={{ height }} />
    </div>
  );
}
