import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const AreaChart = ({
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
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        暂无数据
      </div>
    );
  }
  
  const defaultColors = [
    { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)' },
    { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' },
    { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' },
  ];
  
  const chartColors = colors || defaultColors;
  const chartLabels = labels || yKeys;
  
  const datasets = yKeys.map((yKey, index) => {
    const color = chartColors[index % chartColors.length];
    const strokeColor = typeof color === 'string' ? color : color.stroke;
    const fillColor = typeof color === 'string' ? color + '20' : color.fill;
    
    return {
      label: chartLabels[index],
      data: data.map(d => d[yKey]),
      borderColor: strokeColor,
      backgroundColor: fillColor,
      borderWidth: 2,
      tension: smooth ? 0.4 : 0,
      fill: true,
      pointRadius: data.length <= 30 ? 3 : 0,
      pointHoverRadius: 5,
      pointBackgroundColor: strokeColor,
    };
  });
  
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
        beginAtZero: true,
      },
    },
  };
  
  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};
