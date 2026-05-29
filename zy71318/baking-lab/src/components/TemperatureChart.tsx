import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { SimulationResult } from '../types';
import { TARGET_CENTER_TEMPERATURE } from '../data/materials';

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

interface TemperatureChartProps {
  simulations: SimulationResult[];
  selectedIds: string[];
}

export const TemperatureChart: React.FC<TemperatureChartProps> = ({
  simulations,
  selectedIds
}) => {
  const selectedSimulations = useMemo(() => {
    return simulations.filter(s => selectedIds.includes(s.id));
  }, [simulations, selectedIds]);

  const chartData = useMemo(() => {
    const labels: string[] = [];
    const datasets = selectedSimulations.map(sim => {
      const data = sim.temperatureCurve.map(p => p.temperature);
      
      if (labels.length === 0 || data.length > labels.length) {
        sim.temperatureCurve.forEach((p, i) => {
          labels[i] = `${p.time.toFixed(0)}s`;
        });
      }

      return {
        label: sim.material.name,
        data,
        borderColor: sim.material.color,
        backgroundColor: sim.material.color + '20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: false
      };
    });

    if (datasets.length > 0) {
      const maxLength = Math.max(...datasets.map(d => d.data.length));
      datasets.forEach(d => {
        while (d.data.length < maxLength) {
          (d.data as (number | undefined)[]).push(undefined);
        }
      });
    }

    return { labels, datasets };
  }, [selectedSimulations]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#e0e0e0',
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: '蛋糕中心温度曲线对比',
        color: '#ffffff',
        font: {
          size: 16,
          weight: 'bold' as const
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#e0e0e0',
        borderColor: '#444444',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y?.toFixed(1) || '-'}°C`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '时间 (秒)',
          color: '#a0a0a0',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        ticks: {
          color: '#888888',
          maxTicksLimit: 10
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        title: {
          display: true,
          text: '温度 (°C)',
          color: '#a0a0a0',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        ticks: {
          color: '#888888'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        min: 0,
        max: 260
      }
    }
  }), []);

  if (selectedSimulations.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-lg">请在3D工作台中选择模拟结果</div>
          <div className="text-sm mt-2">以查看温度曲线对比</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-16 left-4 right-4 h-full">
        <Line data={chartData} options={options} />
      </div>
      
      {selectedSimulations.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white text-xs">
          <div className="font-medium mb-1">目标温度线: {TARGET_CENTER_TEMPERATURE}°C</div>
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        </div>
      )}
    </div>
  );
};
