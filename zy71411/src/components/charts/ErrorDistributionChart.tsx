import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useValidationStore, useFilterStore } from '../../store';

interface ErrorDistributionChartProps {
  height?: number;
}

const ErrorDistributionChart: React.FC<ErrorDistributionChartProps> = ({
  height = 300,
}) => {
  const { getAllErrors } = useValidationStore();
  const { getFilteredErrors } = useFilterStore();

  const option = useMemo(() => {
    const allErrors = getAllErrors();
    const filteredErrors = getFilteredErrors(allErrors);

    const errorTypes: Record<string, { error: number; warning: number; info: number }> = {
      link: { error: 0, warning: 0, info: 0 },
      points: { error: 0, warning: 0, info: 0 },
      match: { error: 0, warning: 0, info: 0 },
    };

    filteredErrors.forEach((error) => {
      if (errorTypes[error.type]) {
        errorTypes[error.type][error.severity]++;
      }
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        textStyle: { color: '#374151' },
      },
      legend: {
        data: ['错误', '警告', '提示'],
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: ['合约链路', '点数计算', '收付匹配'],
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { color: '#6B7280' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#6B7280' },
      },
      series: [
        {
          name: '错误',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#DC2626', borderRadius: [0, 0, 0, 0] },
          data: [errorTypes.link.error, errorTypes.points.error, errorTypes.match.error],
        },
        {
          name: '警告',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#D97706' },
          data: [errorTypes.link.warning, errorTypes.points.warning, errorTypes.match.warning],
        },
        {
          name: '提示',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#0284C7', borderRadius: [4, 4, 0, 0] },
          data: [errorTypes.link.info, errorTypes.points.info, errorTypes.match.info],
        },
      ],
    };
  }, [getAllErrors, getFilteredErrors]);

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: 'svg' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
};

export default ErrorDistributionChart;
