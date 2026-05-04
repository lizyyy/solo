import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const BarChart = ({
  data,
  xKey = 'date',
  yKeys,
  colors,
  labels,
  title,
  yAxisLabel,
  height = 300,
  horizontal = false,
  stacked = false,
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
  ];
  
  const chartColors = colors || defaultColors;
  const chartLabels = labels || yKeys;
  
  const datasets = yKeys.map((yKey, index) => ({
    label: chartLabels[index],
    data: data.map(d => d[yKey]),
    backgroundColor: chartColors[index % chartColors.length],
    borderRadius: 4,
  }));
  
  const chartData = {
    labels: data.map(d => {
      if (typeof d[xKey] === 'string' && d[xKey].includes('-')) {
        return format(new Date(d[xKey]), 'MM-dd');
      }
      return d[xKey];
    }),
    datasets,
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: yKeys.length > 1,
        position: 'top',
      },
      title: title ? {
        display: true,
        text: title,
        font: { size: 14, weight: 'normal' },
      } : undefined,
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 12,
      },
    },
    scales: {
      x: horizontal ? {
        title: yAxisLabel ? {
          display: true,
          text: yAxisLabel,
        } : undefined,
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        stacked,
      } : {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 15,
          font: { size: 10 },
        },
        stacked,
      },
      y: horizontal ? {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 10 },
        },
        stacked,
      } : {
        title: yAxisLabel ? {
          display: true,
          text: yAxisLabel,
        } : undefined,
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        ticks: {
          font: { size: 10 },
        },
        stacked,
        beginAtZero: true,
      },
    },
  };
  
  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};
