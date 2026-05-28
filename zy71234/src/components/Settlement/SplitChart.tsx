import { useState } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { SplitDetail } from '../../types';
import { getPartyIcon } from '../../utils/settlementEngine';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SplitChartProps {
  splits: SplitDetail[];
  onSegmentClick?: (split: SplitDetail) => void;
}

export function SplitChart({ splits, onSegmentClick }: SplitChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const data = {
    labels: splits.map(s => `${getPartyIcon(s.partyType)} ${s.partyName}`),
    datasets: [
      {
        data: splits.map(s => s.finalSplit),
        backgroundColor: [
          'rgba(212, 175, 55, 0.8)',
          'rgba(79, 209, 197, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderColor: [
          'rgba(212, 175, 55, 1)',
          'rgba(79, 209, 197, 1)',
          'rgba(139, 92, 246, 1)',
        ],
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e0e0e0',
          font: {
            family: "'Noto Sans SC', sans-serif",
          },
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const split = splits[context.dataIndex];
            return [
              `比例: ${split.finalSplit.toFixed(1)}%`,
              `金额: ¥${split.amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
              `点击查看明细`,
            ];
          },
        },
      },
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0 && onSegmentClick) {
        const index = elements[0].index;
        onSegmentClick(splits[index]);
      }
    },
  };

  return (
    <div className="bg-music-card rounded-xl p-6 border border-white/10">
      <h3 className="text-music-gold font-serif text-lg mb-4 text-center">
        分成比例图表
      </h3>
      <div className="h-64">
        <Pie data={data} options={options} />
      </div>
      {hoveredIndex !== null && (
        <div className="mt-4 p-3 bg-music-darker rounded-lg text-sm">
          <p className="text-gray-300">
            {splits[hoveredIndex].partyName}: {splits[hoveredIndex].finalSplit.toFixed(1)}%
          </p>
        </div>
      )}
      <p className="text-center text-gray-400 text-xs mt-4">
        点击图表各部分可查看详细分成明细
      </p>
    </div>
  );
}
