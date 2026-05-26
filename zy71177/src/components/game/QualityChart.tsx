import React from 'react';
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
  TooltipItem
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { WaterQuality, Level } from '../../types';
import { checkThresholds } from '../../utils/simulation';

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

interface QualityChartProps {
  qualityHistory: WaterQuality[];
  level: Level;
}

export const QualityChart: React.FC<QualityChartProps> = ({ qualityHistory, level }) => {
  const labels = qualityHistory.map((_, index) => `点${index + 1}`);

  const latestQuality = qualityHistory[qualityHistory.length - 1];
  const { passed, failedParams } = checkThresholds(latestQuality, level.targetThresholds);

  const data = {
    labels,
    datasets: [
      {
        label: 'COD (mg/L)',
        data: qualityHistory.map(q => q.cod),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        label: '氨氮 (mg/L)',
        data: qualityHistory.map(q => q.nh3n),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        label: '总磷 (mg/L)',
        data: qualityHistory.map(q => q.tp * 10),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.dataset.label === '总磷 (mg/L)') {
              label += (context.parsed.y / 10).toFixed(2);
            } else {
              label += context.parsed.y.toFixed(1);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(51, 65, 85, 0.5)'
        },
        ticks: {
          color: '#64748b'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: {
          color: 'rgba(51, 65, 85, 0.5)'
        },
        ticks: {
          color: '#64748b'
        },
        title: {
          display: true,
          text: 'COD / 氨氮 (mg/L)',
          color: '#94a3b8'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: '#64748b',
          callback: function(value: string | number) {
            return (Number(value) / 10).toFixed(1);
          }
        },
        title: {
          display: true,
          text: '总磷 (mg/L)',
          color: '#94a3b8'
        }
      }
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">水质指标趋势</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          passed 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          {passed ? '✓ 达标' : `✗ 未达标: ${failedParams.join(', ')}`}
        </div>
      </div>
      
      <div className="h-64">
        <Line data={data} options={options} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="p-2 bg-slate-900/50 rounded-lg text-center">
          <div className="text-xs text-slate-500">COD</div>
          <div className={`font-mono font-bold ${
            latestQuality.cod > level.targetThresholds.cod ? 'text-red-400' : 'text-green-400'
          }`}>
            {latestQuality.cod.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">≤{level.targetThresholds.cod}</div>
        </div>
        <div className="p-2 bg-slate-900/50 rounded-lg text-center">
          <div className="text-xs text-slate-500">氨氮</div>
          <div className={`font-mono font-bold ${
            latestQuality.nh3n > level.targetThresholds.nh3n ? 'text-red-400' : 'text-green-400'
          }`}>
            {latestQuality.nh3n.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">≤{level.targetThresholds.nh3n}</div>
        </div>
        <div className="p-2 bg-slate-900/50 rounded-lg text-center">
          <div className="text-xs text-slate-500">总磷</div>
          <div className={`font-mono font-bold ${
            latestQuality.tp > level.targetThresholds.tp ? 'text-red-400' : 'text-green-400'
          }`}>
            {latestQuality.tp.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500">≤{level.targetThresholds.tp}</div>
        </div>
        <div className="p-2 bg-slate-900/50 rounded-lg text-center">
          <div className="text-xs text-slate-500">pH</div>
          <div className={`font-mono font-bold ${
            latestQuality.ph < 6 || latestQuality.ph > 9 ? 'text-red-400' : 'text-green-400'
          }`}>
            {latestQuality.ph.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">6.0-9.0</div>
        </div>
      </div>
    </div>
  );
};
