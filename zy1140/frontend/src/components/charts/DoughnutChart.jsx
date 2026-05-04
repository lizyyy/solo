import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export const DoughnutChart = ({
  data,
  labelKey = 'label',
  valueKey = 'value',
  colors,
  title,
  height = 300,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        暂无数据
      </div>
    );
  }
  
  const defaultColors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
  ];
  
  const chartColors = colors || defaultColors;
  
  const chartData = {
    labels: data.map(d => d[labelKey]),
    datasets: [{
      data: data.map(d => d[valueKey]),
      backgroundColor: data.map((_, i) => chartColors[i % chartColors.length]),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: { size: 12 },
        },
      },
      title: title ? {
        display: true,
        text: title,
        font: { size: 14, weight: 'normal' },
        padding: { bottom: 20 },
      } : undefined,
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 12,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };
  
  return (
    <div style={{ height }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
};
