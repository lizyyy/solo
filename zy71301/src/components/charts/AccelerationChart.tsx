import { useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import type { AccelerationSample, AnomalyEvent, PlayerFeedback, CameraSegment } from '@/types';
import { useSessionStore } from '@/store/sessionStore';

interface AccelerationChartProps {
  data: AccelerationSample[];
  anomalies: AnomalyEvent[];
  feedbacks: PlayerFeedback[];
  segments: CameraSegment[];
  height?: number;
}

export default function AccelerationChart({
  data,
  anomalies,
  feedbacks,
  segments,
  height = 400,
}: AccelerationChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { selectedAnomalyId, selectAnomaly } = useSessionStore();
  const [selectedTime, setSelectedTime] = useState<number | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    const times = data.map((d) => d.timestamp.toFixed(2));
    const accelX = data.map((d) => d.linearAccel.x);
    const accelY = data.map((d) => d.linearAccel.y);
    const accelZ = data.map((d) => d.linearAccel.z);
    const magnitude = data.map((d) => d.magnitude);

    const anomalyMarkAreas = anomalies.map((anomaly) => [
      {
        xAxis: anomaly.startTime.toFixed(2),
        itemStyle: {
          color:
            anomaly.severity === 'critical'
              ? 'rgba(239, 68, 68, 0.3)'
              : anomaly.severity === 'high'
              ? 'rgba(249, 115, 22, 0.25)'
              : anomaly.severity === 'medium'
              ? 'rgba(234, 179, 8, 0.2)'
              : 'rgba(59, 130, 246, 0.15)',
        },
      },
      { xAxis: anomaly.endTime.toFixed(2) },
    ]);

    const feedbackMarkPoints = feedbacks.map((fb) => ({
      name: '玩家反馈',
      xAxis: fb.timestamp.toFixed(2),
      yAxis: 15,
      symbol: 'circle',
      symbolSize: 10,
      itemStyle: {
        color:
          fb.severity >= 4
            ? '#ef4444'
            : fb.severity >= 3
            ? '#f97316'
            : '#eab308',
      },
      label: {
        show: false,
      },
      tooltip: {
        formatter: `玩家反馈: ${fb.type}<br/>严重程度: ${fb.severity}/5<br/>${fb.description}`,
      },
    }));

    const segmentAreas = segments.map((seg) => [
      {
        xAxis: seg.startTime.toFixed(2),
        itemStyle: {
          color: `${seg.color}15`,
        },
      },
      { xAxis: seg.endTime.toFixed(2) },
    ]);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 18, 24, 0.95)',
        borderColor: 'rgba(78, 89, 105, 0.5)',
        textStyle: {
          color: '#e5e6eb',
        },
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: 'rgba(22, 93, 255, 0.5)',
          },
        },
      },
      legend: {
        data: ['X轴', 'Y轴', 'Z轴', '合加速度'],
        top: 0,
        textStyle: {
          color: '#86909c',
        },
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '10%',
        top: '15%',
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
          interval: Math.floor(data.length / 10),
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: '加速度 (m/s²)',
        nameTextStyle: {
          color: '#86909c',
        },
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
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 5,
          borderColor: 'transparent',
          backgroundColor: 'rgba(39, 46, 59, 0.5)',
          fillerColor: 'rgba(22, 93, 255, 0.3)',
          handleStyle: {
            color: '#165dff',
          },
          textStyle: {
            color: '#86909c',
          },
        },
      ],
      series: [
        {
          name: '镜头段落',
          type: 'line',
          data: new Array(data.length).fill(null),
          markArea: {
            silent: true,
            data: segmentAreas as any,
          },
        },
        {
          name: '异常区域',
          type: 'line',
          data: new Array(data.length).fill(null),
          markArea: {
            data: anomalyMarkAreas as any,
          },
        },
        {
          name: '玩家反馈',
          type: 'scatter',
          data: [],
          markPoint: {
            data: feedbackMarkPoints as any,
            symbol: 'pin',
            symbolSize: 20,
          },
        },
        {
          name: 'X轴',
          type: 'line',
          data: accelX,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            color: '#3b82f6',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ]),
          },
        },
        {
          name: 'Y轴',
          type: 'line',
          data: accelY,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            color: '#10b981',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0)' },
            ]),
          },
        },
        {
          name: 'Z轴',
          type: 'line',
          data: accelZ,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            color: '#f59e0b',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0)' },
            ]),
          },
        },
        {
          name: '合加速度',
          type: 'line',
          data: magnitude,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: '#ef4444',
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    chartInstance.current.on('click', (params: any) => {
      if (params.componentType === 'markArea') {
        const anomalyIndex = anomalies.findIndex(
          (a) =>
            a.startTime.toFixed(2) === params.data[0].xAxis &&
            a.endTime.toFixed(2) === params.data[1].xAxis
        );
        if (anomalyIndex >= 0) {
          selectAnomaly(anomalies[anomalyIndex].id);
        }
      }
    });

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, anomalies, feedbacks, segments, selectAnomaly]);

  return (
    <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-white">加速度时序图</h3>
        <div className="flex items-center gap-4 text-xs text-dark-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 rounded" /> X轴
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-500 rounded" /> Y轴
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-yellow-500 rounded" /> Z轴
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-500 rounded" /> 合加速度
          </span>
        </div>
      </div>
      <div ref={chartRef} style={{ height }} />
    </div>
  );
}
