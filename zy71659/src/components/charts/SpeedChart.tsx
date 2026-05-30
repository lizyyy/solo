import React from 'react';
import { BaseChart } from './BaseChart';
import { AlignedSample, Anomaly } from '@/types';

interface SpeedChartProps {
  samples: AlignedSample[];
  anomalies: Anomaly[];
  onChartReady?: (chart: echarts.ECharts) => void;
}

export const SpeedChart: React.FC<SpeedChartProps> = ({ samples, anomalies, onChartReady }) => {
  return (
    <BaseChart
      title="转速曲线"
      yAxisName="转速"
      seriesName="转速"
      color="#3B82F6"
      samples={samples}
      anomalies={anomalies}
      getDataValue={(s) => s.speed}
      yAxisMin={0}
      yAxisMax={3000}
      unit=" rpm"
      onChartReady={onChartReady}
    />
  );
};
