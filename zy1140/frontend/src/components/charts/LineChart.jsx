import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const LineChart = ({
  data,
  xKey = 'date',
  yKeys,
  colors,
  labels,
  title,
  yAxisLabel,
  yAxisMin,
  yAxisMax,
  height = 300,
  smooth = true,
  fill = false,
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
    borderColor: chartColors[index % chartColors.length],
    backgroundColor: fill 
      ? chartColors[index % chartColors.length] + '20'
      : 'transparent',
    borderWidth: 2,
    tension: smooth ? 0.4 : 0,
    fill: fill,
    pointRadius: data.length <= 30 ? 3 : 0,
    pointHoverRadius: 5,
    pointBackgroundColor: chartColors[index % chartColors.length],
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
        titleFont: { size: 12 },
        bodyFont: { size: 12 },
        callbacks: {
          title: (items) => {
            if (items.length > 0) {
              const item = items[0];
              const originalData = data[item.dataIndex];
              if (originalData[xKey] && originalData[xKey].includes('-')) {
                return format(new Date(originalData[xKey]), 'yyyy年MM月dd日');
              }
              return originalData[xKey];
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
          font: { size: 10 },
        },
      },
      y: {
        min: yAxisMin,
        max: yAxisMax,
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
      },
    },
  };
  
  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};
