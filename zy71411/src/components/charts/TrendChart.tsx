import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useContractStore, useFilterStore } from '@/store';
import dayjs from 'dayjs';

interface TrendChartProps {
  height?: number;
}

const TrendChart: React.FC<TrendChartProps> = ({ height = 300 }) => {
  const { contracts } = useContractStore();
  const { getFilteredContracts } = useFilterStore();

  const option = useMemo(() => {
    const filteredContracts = getFilteredContracts(contracts);

    const monthlyData = filteredContracts.reduce(
      (acc, contract) => {
        const month = dayjs(contract.tradeDate).format('YYYY-MM');
        if (!acc[month]) {
          acc[month] = { total: 0, rolled: 0 };
        }
        acc[month].total++;
        if (contract.status === 'rolled') {
          acc[month].rolled++;
        }
        return acc;
      },
      {} as Record<string, { total: number; rolled: number }>
    );

    const sortedMonths = Object.keys(monthlyData).sort();
    const totalData = sortedMonths.map((m) => monthlyData[m].total);
    const rolledData = sortedMonths.map((m) => monthlyData[m].rolled);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        textStyle: { color: '#374151' },
      },
      legend: {
        data: ['合约总数', '展期数'],
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
        boundaryGap: false,
        data: sortedMonths,
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
          name: '合约总数',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#1E40AF' },
          itemStyle: { color: '#1E40AF' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(30, 64, 175, 0.25)' },
                { offset: 1, color: 'rgba(30, 64, 175, 0.02)' },
              ],
            },
          },
          data: totalData,
        },
        {
          name: '展期数',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#059669' },
          itemStyle: { color: '#059669' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(5, 150, 105, 0.25)' },
                { offset: 1, color: 'rgba(5, 150, 105, 0.02)' },
              ],
            },
          },
          data: rolledData,
        },
      ],
    };
  }, [contracts, getFilteredContracts]);

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

export default TrendChart;
