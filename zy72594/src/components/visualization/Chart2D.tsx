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
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { VisualizationDataPoint } from '../../types';

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

interface Chart2DProps {
  data: VisualizationDataPoint[];
  onPointClick: (point: VisualizationDataPoint) => void;
}

export function Chart2D({ data, onPointClick }: Chart2DProps) {
  const chartRef = useRef<ChartJS<'scatter'>>(null);

  const chartData = {
    datasets: [
      {
        label: '主数据点',
        data: data.filter(d => d.sourceType === 'bucket').map(d => ({
          x: d.x,
          y: d.y,
          ...d,
        })),
        backgroundColor: data.filter(d => d.sourceType === 'bucket').map(d =>
          d.hasTimeWindowIssue ? 'rgba(251, 191, 36, 0.8)' : 'rgba(14, 165, 233, 0.8)'
        ),
        borderColor: data.filter(d => d.sourceType === 'bucket').map(d =>
          d.hasTimeWindowIssue ? 'rgb(251, 191, 36)' : 'rgb(14, 165, 233)'
        ),
        borderWidth: 1,
        pointRadius: 8,
        pointHoverRadius: 12,
      },
      {
        label: '负样本',
        data: data.filter(d => d.sourceType === 'negative_sample').map(d => ({
          x: d.x,
          y: d.y,
          ...d,
        })),
        backgroundColor: data.filter(d => d.sourceType === 'negative_sample').map(d =>
          d.hasTimeWindowIssue ? 'rgba(251, 191, 36, 0.8)' : 'rgba(244, 63, 94, 0.8)'
        ),
        borderColor: data.filter(d => d.sourceType === 'negative_sample').map(d =>
          d.hasTimeWindowIssue ? 'rgb(251, 191, 36)' : 'rgb(244, 63, 94)'
        ),
        borderWidth: 1,
        pointRadius: 8,
        pointHoverRadius: 12,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const raw = context.raw as VisualizationDataPoint;
            return [
              `标签: ${raw.label}`,
              `置信度: ${(raw.confidence * 100).toFixed(1)}%`,
              raw.hasTimeWindowIssue ? '⚠️ 存在时间窗穿越问题' : '',
            ].filter(Boolean);
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'X轴特征' },
        min: 0,
        max: 1,
      },
      y: {
        title: { display: true, text: 'Y轴特征' },
        min: 0,
        max: 1,
      },
    },
    onClick: (_event: unknown, elements: any[]) => {
      if (elements.length > 0) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const dataset = chartData.datasets[datasetIndex];
        const point = dataset.data[index] as VisualizationDataPoint;
        onPointClick(point);
      }
    },
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      chart.canvas.style.cursor = 'pointer';
    }
  }, []);

  return (
    <div className="bg-slate-900 rounded-xl p-6">
      <Scatter ref={chartRef} data={chartData} options={options} />
      <p className="text-center text-xs text-slate-500 mt-4">
        点击数据点可回溯至对应线上实验桶或负样本列表
      </p>
    </div>
  );
}
