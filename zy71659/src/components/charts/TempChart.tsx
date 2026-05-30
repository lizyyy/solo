import React from 'react';
import { BaseChart } from './BaseChart';
import { AlignedSample, Anomaly } from '@/types';

interface TempChartProps {
  samples: AlignedSample[];
  anomalies: Anomaly[];
  onChartReady?: (chart: echarts.ECharts) => void;
}

export const TempChart: React.FC<TempChartProps> = ({ samples, anomalies, onChartReady }) => {
  return (
    <BaseChart
      title="温度曲线"
      yAxisName="温度"
      seriesName="温度"
      color="#EF4444"
      samples={samples}
      anomalies={anomalies}
      getDataValue={(s) => s.temperature}
      yAxisMin={20}
      yAxisMax={150}
      unit=" °C"
      threshold={{ value: 130, label: '报警阈值 130°C' }}
      onChartReady={onChartReady}
    />
  );
};
