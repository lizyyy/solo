import React from 'react';
import { BaseChart } from './BaseChart';
import { AlignedSample, Anomaly } from '@/types';

interface TorqueChartProps {
  samples: AlignedSample[];
  anomalies: Anomaly[];
  onChartReady?: (chart: echarts.ECharts) => void;
}

export const TorqueChart: React.FC<TorqueChartProps> = ({ samples, anomalies, onChartReady }) => {
  return (
    <BaseChart
      title="扭矩曲线"
      yAxisName="扭矩"
      seriesName="扭矩"
      color="#10B981"
      samples={samples}
      anomalies={anomalies}
      getDataValue={(s) => s.torque}
      yAxisMin={0}
      yAxisMax={500}
      unit=" N·m"
      onChartReady={onChartReady}
    />
  );
};
