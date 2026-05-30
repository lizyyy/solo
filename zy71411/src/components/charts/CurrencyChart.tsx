import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useContractStore, useFilterStore } from '../../store';

interface CurrencyChartProps {
  height?: number;
}

const CurrencyChart: React.FC<CurrencyChartProps> = ({ height = 280 }) => {
  const { contracts } = useContractStore();
  const { getFilteredContracts } = useFilterStore();

  const option = useMemo(() => {
    const filteredContracts = getFilteredContracts(contracts);

    const currencyCount: Record<string, number> = {};
    filteredContracts.forEach((c) => {
      const [base] = c.currencyPair.split('/');
      currencyCount[base] = (currencyCount[base] || 0) + 1;
    });

    const data = Object.entries(currencyCount).map(([name, value]) => ({
      name,
      value,
    }));

    const colors = ['#1E40AF', '#059669', '#D97706', '#0284C7', '#7C3AED'];

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        textStyle: { color: '#374151' },
        formatter: '{b}: {c} 份 ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
      },
      color: colors,
      series: [
        {
          name: '币种分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
          labelLine: {
            show: false,
          },
          data,
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

export default CurrencyChart;
