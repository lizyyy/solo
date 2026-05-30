import React, { useRef, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, ECharts } from 'echarts';
import { useAppStore } from '@/store/useAppStore';
import { AlignedSample, Anomaly } from '@/types';
import { formatTime } from '@/utils/formatters';

interface BaseChartProps {
  title: string;
  yAxisName: string;
  seriesName: string;
  color: string;
  samples: AlignedSample[];
  anomalies: Anomaly[];
  getDataValue: (sample: AlignedSample) => number;
  yAxisMin?: number;
  yAxisMax?: number;
  unit?: string;
  threshold?: { value: number; label: string };
  onChartReady?: (chart: ECharts) => void;
}

export const BaseChart: React.FC<BaseChartProps> = ({
  title,
  yAxisName,
  seriesName,
  color,
  samples,
  anomalies,
  getDataValue,
  yAxisMin,
  yAxisMax,
  unit = '',
  threshold,
  onChartReady,
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const { selectedSampleId, selectedAnomalyId, highlightSample, highlightAnomaly } = useAppStore();

  const getMarkAreas = useCallback(() => {
    const areas: Array<Record<string, unknown>> = [];

    anomalies.forEach((anomaly) => {
      const affectedSamples = samples.filter(s => s.anomalyIds.includes(anomaly.id));
      if (affectedSamples.length === 0) return;

      const startTime = Math.min(...affectedSamples.map(s => s.timestamp));
      const endTime = Math.max(...affectedSamples.map(s => s.timestamp));

      let areaColor = '';
      let label = '';

      switch (anomaly.type) {
        case 'temp_over_limit':
          areaColor = 'rgba(239, 68, 68, 0.15)';
          label = `温升超限 ${anomaly.detail.tempValue}°C`;
          break;
        case 'sampling_shift':
          areaColor = 'rgba(139, 92, 246, 0.15)';
          label = `采样错位 +${anomaly.detail.shiftOffset}ms`;
          break;
        case 'missing_load':
          areaColor = 'rgba(245, 158, 11, 0.15)';
          label = '负载档漏记';
          break;
        case 'duplicate_data':
          areaColor = 'rgba(100, 116, 139, 0.15)';
          label = '重复数据';
          break;
        case 'supplement_data':
          areaColor = 'rgba(6, 182, 212, 0.15)';
          label = '补录数据';
          break;
      }

      if (anomaly.id === selectedAnomalyId) {
        areaColor = areaColor.replace('0.15', '0.35');
      }

      areas.push({
        itemStyle: { color: areaColor },
        label: {
          show: true,
          formatter: label,
          position: 'top',
        },
        xAxis: [startTime, endTime],
      });
    });

    return areas;
  }, [anomalies, samples, selectedAnomalyId]);

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    title: {
      text: title,
      left: 10,
      top: 5,
      textStyle: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: 500,
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderColor: '#475569',
      borderWidth: 1,
      textStyle: { color: '#F1F5F9', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as Array<{ dataIndex: number; value: [number, number] }>;
        if (!p || p.length === 0) return '';
        const idx = p[0].dataIndex;
        const sample = samples[idx];
        if (!sample) return '';
        const value = getDataValue(sample);
        return `
          <div style="font-family: 'JetBrains Mono', monospace;">
            <div style="color: #64748B; margin-bottom: 4px;">${formatTime(sample.timestamp)}</div>
            <div style="color: ${color}; font-weight: 500;">${seriesName}: ${value.toFixed(2)} ${unit}</div>
            <div style="color: #64748B; margin-top: 4px; font-size: 10px;">采样ID: ${sample.id?.slice(-8)}</div>
            ${sample.anomalyIds.length > 0 ? `<div style="color: #EF4444; margin-top: 2px; font-size: 10px;">⚠️ 关联异常: ${sample.anomalyIds.length}个</div>` : ''}
          </div>
        `;
      },
    },
    grid: {
      left: 60,
      right: 20,
      top: 40,
      bottom: 30,
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: {
        color: '#64748B',
        fontSize: 10,
        formatter: (value: number) => formatTime(value),
      },
      splitLine: { lineStyle: { color: 'rgba(51, 65, 85, 0.3)', type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      nameTextStyle: { color: '#64748B', fontSize: 10 },
      min: yAxisMin,
      max: yAxisMax,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: {
        color: '#64748B',
        fontSize: 10,
        formatter: (value: number) => `${value}${unit}`,
      },
      splitLine: { lineStyle: { color: 'rgba(51, 65, 85, 0.3)', type: 'dashed' } },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    series: [
      {
        name: seriesName,
        type: 'line',
        smooth: false,
        symbol: 'circle',
        symbolSize: (value: [number, number], params: { dataIndex: number }) => {
          const sample = samples[params.dataIndex];
          if (!sample) return 4;
          if (sample.id === selectedSampleId) return 10;
          if (sample.anomalyIds.length > 0) return 6;
          return 3;
        },
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const sample = samples[params.dataIndex];
            if (!sample) return color;
            if (sample.id === selectedSampleId) return '#3B82F6';
            if (sample.anomalyIds.length > 0) return '#EF4444';
            return color;
          },
        },
        lineStyle: {
          color: color,
          width: 1.5,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '30' },
              { offset: 1, color: color + '05' },
            ],
          },
        },
        markArea: {
          silent: false,
          data: getMarkAreas() as unknown as unknown[][],
        },
        markLine: threshold ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#EF4444', type: 'dashed', width: 1 },
          label: {
            formatter: threshold.label,
            color: '#EF4444',
            fontSize: 10,
            position: 'end',
          },
          data: [{ yAxis: threshold.value }],
        } : undefined,
        data: samples.map((s) => [s.timestamp, getDataValue(s)]),
      } as unknown,
    ],
  };

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current.getEchartsInstance();
    
    chart.on('click', (params: { dataIndex: number; componentType: string }) => {
      if (params.componentType === 'series') {
        const sample = samples[params.dataIndex];
        if (sample?.id) {
          highlightSample(sample.id);
        }
      }
    });

    if (onChartReady) {
      onChartReady(chart);
    }

    return () => {
      chart.off('click');
    };
  }, [samples, highlightSample, onChartReady]);

  useEffect(() => {
    if (!chartRef.current || !selectedSampleId) return;
    const chart = chartRef.current.getEchartsInstance();
    const idx = samples.findIndex(s => s.id === selectedSampleId);
    if (idx >= 0) {
      const sample = samples[idx];
      chart.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: idx,
      });
      chart.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        dataIndex: idx,
      });
    }
  }, [selectedSampleId, samples]);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current.getEchartsInstance();
    if (selectedAnomalyId) {
      const anomaly = anomalies.find(a => a.id === selectedAnomalyId);
      if (anomaly) {
        const affectedSamples = samples.filter(s => s.anomalyIds.includes(anomaly.id));
        if (affectedSamples.length > 0) {
          const startTime = Math.min(...affectedSamples.map(s => s.timestamp));
          const endTime = Math.max(...affectedSamples.map(s => s.timestamp));
          chart.dispatchAction({
            type: 'dataZoom',
            startValue: startTime - 30000,
            endValue: endTime + 30000,
          });
        }
      }
    }
  }, [selectedAnomalyId, anomalies, samples]);

  return (
    <div className="card h-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: '100%', minHeight: '200px' }}
        notMerge={true}
        lazyUpdate={false}
      />
    </div>
  );
};
