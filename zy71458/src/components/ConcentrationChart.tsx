import { useRef, useEffect } from 'react';
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
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';

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

export const ConcentrationChart = () => {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const { config, results, conclusion, selectTimePoint, selectedTimePoint } = useSimulationStore();
  const { drug } = config;

  useEffect(() => {
    if (results.length === 0 || !chartRef.current) return;
    
    const chart = chartRef.current;
    
    const handleClick = (event: MouseEvent) => {
      const points = chart.getElementsAtEventForMode(
        event,
        'nearest',
        { intersect: false },
        false
      );
      
      if (points.length > 0) {
        const index = points[0].index;
        const point = results[index];
        if (point) {
          selectTimePoint(point);
        }
      }
    };

    const canvas = chart.canvas;
    canvas.addEventListener('click', handleClick);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [results, selectTimePoint]);

  const chartData: ChartData<'line'> = {
    labels: results.map((r) => r.time.toFixed(1)),
    datasets: [
      {
        label: '血药浓度',
        data: results.map((r) => r.concentration),
        borderColor: '#0EA5E9',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: results.map((r) => {
          if (selectedTimePoint && Math.abs(r.time - selectedTimePoint.time) < 0.1) {
            return 8;
          }
          return r.isDosingPoint ? 4 : 0;
        }),
        pointBackgroundColor: results.map((r) => {
          if (selectedTimePoint && Math.abs(r.time - selectedTimePoint.time) < 0.1) {
            return '#F59E0B';
          }
          return r.isDosingPoint ? '#10B981' : '#0EA5E9';
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        segment: {
          borderColor: (ctx) => {
            const index = (ctx as unknown as { p0Index: number }).p0Index;
            const point = results[index];
            if (point?.isAboveMax) return '#EF4444';
            if (point?.isBelowMin) return '#F59E0B';
            return '#0EA5E9';
          },
        },
      },
      {
        label: '最高安全浓度',
        data: results.map(() => drug.therapeuticMax),
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: '最低有效浓度',
        data: results.map(() => drug.therapeuticMin),
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onClick: (_event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const point = results[index];
        if (point) {
          selectTimePoint(point);
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#94A3B8',
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (items) => `时间: ${items[0].label} h`,
          label: (item) => {
            const label = item.dataset.label || '';
            const value = item.raw as number;
            return `${label}: ${value.toFixed(3)} ${drug.unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '时间 (小时)',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          maxTicksLimit: 12,
        },
      },
      y: {
        title: {
          display: true,
          text: `血药浓度 (${drug.unit})`,
          font: {
            size: 14,
            weight: 'bold',
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-sky-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">血药浓度曲线</h2>
            <p className="text-sm text-gray-500">点击曲线查看详细数据</p>
          </div>
        </div>
        {conclusion && (
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            conclusion.hasConcentrationIssue
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {conclusion.hasConcentrationIssue ? '⚠️ 存在浓度问题' : '✓ 参数合理'}
          </div>
        )}
      </div>
      
      <div className="flex-1 min-h-[400px]">
        {results.length > 0 ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Activity className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">点击"运行模拟"查看浓度曲线</p>
          </div>
        )}
      </div>
    </div>
  );
};
