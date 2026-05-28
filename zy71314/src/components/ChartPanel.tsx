import { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Scatter, Pie, Bar } from 'react-chartjs-2';
import { usePendulumStore } from '@/store/usePendulumStore';
import type { ChartType } from '@/types';
import { exportChartAsPNG } from '@/utils/export';
import { CHART_COLORS } from '@/utils/constants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartTabs: { key: ChartType; label: string }[] = [
  { key: 't2-vs-l', label: 'T²-L 关系图' },
  { key: 'residual', label: '残差分析' },
  { key: 'error-pie', label: '误差来源' },
  { key: 'distribution', label: '数据分布' },
];

export default function ChartPanel() {
  const { data, result, selectedChart, setSelectedChart, setChartRef } = usePendulumStore();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const validData = data.filter(d => !d.excluded && d.length > 0 && d.period > 0);
  const lengths = validData.map(d => d.length);
  const periods = validData.map(d => d.period);
  const tSquared = periods.map(T => T * T);

  useEffect(() => {
    const canvas = chartContainerRef.current?.querySelector('canvas');
    if (canvas) {
      setChartRef(selectedChart, canvas);
    }
    return () => setChartRef(selectedChart, null);
  }, [selectedChart, setChartRef]);

  const handleExport = async () => {
    const canvas = chartContainerRef.current?.querySelector('canvas');
    if (canvas) {
      await exportChartAsPNG(canvas, `单摆图表-${chartTabs.find(t => t.key === selectedChart)?.label}`);
    }
  };

  const t2vsLData = {
    datasets: [
      {
        label: '实验数据',
        data: lengths.map((L, i) => ({ x: L, y: tSquared[i] })),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        pointRadius: 8,
        pointHoverRadius: 10,
      },
      ...(result
        ? [
            {
              label: '拟合直线',
              data: [
                { x: Math.min(...lengths) * 0.9, y: result.fitSlope * Math.min(...lengths) * 0.9 + result.fitIntercept },
                { x: Math.max(...lengths) * 1.1, y: result.fitSlope * Math.max(...lengths) * 1.1 + result.fitIntercept },
              ],
              type: 'line',
              borderColor: '#10b981',
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
            } as any,
          ]
        : []),
    ],
  };

  const t2vsLOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            if (ctx.datasetIndex === 0) {
              return `L=${ctx.parsed.x.toFixed(3)}m, T²=${ctx.parsed.y.toFixed(4)}s²`;
            }
            return `拟合: T² = ${result?.fitSlope.toFixed(4)}L + ${result?.fitIntercept.toFixed(4)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: '摆长 L (m)', color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        title: { display: true, text: '周期平方 T² (s²)', color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#94a3b8' },
      },
    },
  };

  const residualData = {
    labels: validData.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: '残差',
        data: result?.residuals || [],
        backgroundColor: result?.residuals.map(r =>
          Math.abs(r) > 0.1 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)'
        ) || [],
        borderColor: result?.residuals.map(r =>
          Math.abs(r) > 0.1 ? '#ef4444' : '#3b82f6'
        ) || [],
        borderWidth: 1,
      },
    ],
  };

  const residualOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        title: { display: true, text: '数据点', color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        title: { display: true, text: '残差 (s²)', color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#94a3b8' },
      },
    },
  };

  const errorPieData = {
    labels: result?.errorSources.map(e => e.name) || [],
    datasets: [
      {
        data: result?.errorSources.map(e => e.contribution) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
        ],
        borderWidth: 2,
      },
    ],
  };

  const errorPieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: '#94a3b8', padding: 15 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
        },
      },
    },
  };

  const distributionData = {
    labels: ['0.2-0.5m', '0.5-0.8m', '0.8-1.1m', '1.1-1.4m', '1.4-1.7m', '1.7-2.0m'],
    datasets: [
      {
        label: '数据点数量',
        data: [
          lengths.filter(l => l >= 0.2 && l < 0.5).length,
          lengths.filter(l => l >= 0.5 && l < 0.8).length,
          lengths.filter(l => l >= 0.8 && l < 1.1).length,
          lengths.filter(l => l >= 1.1 && l < 1.4).length,
          lengths.filter(l => l >= 1.4 && l < 1.7).length,
          lengths.filter(l => l >= 1.7 && l <= 2.0).length,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3b82f6',
        borderWidth: 2,
      },
    ],
  };

  const distributionOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        title: { display: true, text: '摆长区间', color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        title: { display: true, text: '数据点数', color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#94a3b8', stepSize: 1 },
      },
    },
  };

  const renderChart = () => {
    if (validData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <p>暂无数据，无法绘制图表</p>
          </div>
        </div>
      );
    }

    switch (selectedChart) {
      case 't2-vs-l':
        return <Scatter data={t2vsLData} options={t2vsLOptions} />;
      case 'residual':
        return result ? (
          <Bar data={residualData} options={residualOptions} />
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            请先进行计算以查看残差分析
          </div>
        );
      case 'error-pie':
        return result ? (
          <Pie data={errorPieData} options={errorPieOptions} />
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            请先进行计算以查看误差分析
          </div>
        );
      case 'distribution':
        return <Bar data={distributionData} options={distributionOptions} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">数据可视化</h2>
        <button
          onClick={handleExport}
          disabled={validData.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          导出图片
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {chartTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedChart(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedChart === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} className="h-80">
        {renderChart()}
      </div>
    </div>
  );
}
