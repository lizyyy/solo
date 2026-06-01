import { useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
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
import { Activity, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useVibrationStore } from '@/store/useVibrationStore';
import { judgeThreshold, getThresholdLevelText, getThresholdLevelBg } from '@/utils/threshold';
import { calculatePhysics } from '@/utils/physics';
import { cn } from '@/lib/utils';
import { THRESHOLD_BOUNDARIES } from '@/types';
import type { ThresholdLevel } from '@/types';

const THRESHOLD_CARDS: {
  level: ThresholdLevel;
  range: string;
  borderClass: string;
  glowClass: string;
  icon: typeof CheckCircle;
}[] = [
  {
    level: '正常',
    range: `< ${THRESHOLD_BOUNDARIES.normal} mm/s`,
    borderClass: 'border-t-emerald-500',
    glowClass: 'shadow-emerald-500/10',
    icon: CheckCircle,
  },
  {
    level: '警告',
    range: `${THRESHOLD_BOUNDARIES.normal} ~ ${THRESHOLD_BOUNDARIES.warning} mm/s`,
    borderClass: 'border-t-amber-500',
    glowClass: 'shadow-amber-500/10',
    icon: AlertTriangle,
  },
  {
    level: '危险',
    range: `> ${THRESHOLD_BOUNDARIES.warning} mm/s`,
    borderClass: 'border-t-red-500',
    glowClass: 'shadow-red-500/10',
    icon: AlertCircle,
  },
];

const LEVEL_ICON_COLOR: Record<ThresholdLevel, string> = {
  '正常': 'text-emerald-400',
  '警告': 'text-amber-400',
  '危险': 'text-red-400',
};

export default function DashboardPage() {
  const { records, compressors, selectedCompressorId } = useVibrationStore();

  useEffect(() => {
    ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
  }, []);

  const selectedCompressor = compressors.find(c => c.id === selectedCompressorId);
  const compressorRecords = useMemo(
    () => records.filter(r => r.compressorId === selectedCompressorId),
    [records, selectedCompressorId],
  );

  const counts = useMemo(() => {
    const c: Record<ThresholdLevel, number> = { '正常': 0, '警告': 0, '危险': 0 };
    compressorRecords.forEach(r => { c[judgeThreshold(r.amplitudeMmPerS).level]++; });
    return c;
  }, [compressorRecords]);

  const chartData = useMemo(() => {
    const grouped: Record<ThresholdLevel, { x: number; y: number }[]> = {
      '正常': [],
      '警告': [],
      '危险': [],
    };
    compressorRecords.forEach(r => {
      grouped[judgeThreshold(r.amplitudeMmPerS).level].push({ x: r.frequencyHz, y: r.amplitudeMmPerS });
    });

    const maxFreq = compressorRecords.length > 0
      ? Math.max(...compressorRecords.map(r => r.frequencyHz)) * 1.2
      : 200;

    return {
      datasets: [
        {
          label: '正常',
          data: grouped['正常'],
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
        },
        {
          label: '警告',
          data: grouped['警告'],
          backgroundColor: '#f59e0b',
          borderColor: '#f59e0b',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
        },
        {
          label: '危险',
          data: grouped['危险'],
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
        },
        {
          label: `警告阈值 (${THRESHOLD_BOUNDARIES.normal} mm/s)`,
          data: [{ x: 0, y: THRESHOLD_BOUNDARIES.normal }, { x: maxFreq, y: THRESHOLD_BOUNDARIES.normal }],
          borderColor: '#f59e0b',
          borderDash: [8, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `危险阈值 (${THRESHOLD_BOUNDARIES.warning} mm/s)`,
          data: [{ x: 0, y: THRESHOLD_BOUNDARIES.warning }, { x: maxFreq, y: THRESHOLD_BOUNDARIES.warning }],
          borderColor: '#ef4444',
          borderDash: [8, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [compressorRecords]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9ca3af' },
        },
        title: {
          display: true,
          text: '频谱分析图',
          color: '#e5e7eb',
          font: { size: 16 },
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          title: {
            display: true,
            text: '频率 (Hz)',
            color: '#9ca3af',
          },
          ticks: { color: '#6b7280' },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          type: 'linear' as const,
          title: {
            display: true,
            text: '振幅 (mm/s)',
            color: '#9ca3af',
          },
          ticks: { color: '#6b7280' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true,
        },
      },
    }),
    [],
  );

  const fundamentalHz = selectedCompressor ? selectedCompressor.ratedRpm / 60 : 0;
  const harmonics = useMemo(() => {
    if (fundamentalHz <= 0) return [];
    return Array.from({ length: 6 }, (_, i) => Math.round(fundamentalHz * (i + 1) * 100) / 100);
  }, [fundamentalHz]);

  const recordPhysics = useMemo(
    () => compressorRecords.map(r => ({
      ...r,
      physics: calculatePhysics(r.amplitudeMmPerS, r.frequencyHz, r.rpm),
      threshold: judgeThreshold(r.amplitudeMmPerS),
    })),
    [compressorRecords],
  );

  return (
    <div className="min-h-screen bg-[#1a1d23] p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {THRESHOLD_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.level}
              className={cn(
                'bg-[#22262e] border-t-4 rounded-lg p-5 shadow-lg',
                card.borderClass,
                card.glowClass,
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn('text-lg font-semibold', getThresholdLevelText(card.level))}>
                  {card.level}
                </span>
                <Icon className={cn('w-5 h-5', LEVEL_ICON_COLOR[card.level])} />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{counts[card.level]}</div>
              <div className="text-sm text-gray-500">阈值范围: {card.range}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#22262e] rounded-lg p-5">
          <div className="h-[400px]">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-[#22262e] rounded-lg p-5 space-y-4 overflow-auto max-h-[500px]">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            物理量近似计算
          </h3>

          {selectedCompressor ? (
            <div className="space-y-3 text-sm">
              <div className="bg-[#1a1d23] rounded p-3">
                <div className="text-gray-400 mb-1">压缩机: {selectedCompressor.name}</div>
                <div className="text-gray-400">转速: {selectedCompressor.ratedRpm} RPM</div>
              </div>

              <div className="bg-[#1a1d23] rounded p-3">
                <div className="text-gray-400 mb-2">基频</div>
                <div className="text-white font-mono text-lg">
                  {Math.round(fundamentalHz * 100) / 100} Hz
                </div>
              </div>

              <div className="bg-[#1a1d23] rounded p-3">
                <div className="text-gray-400 mb-2">倍频分量</div>
                <div className="grid grid-cols-2 gap-2">
                  {harmonics.map((h, i) => (
                    <div key={i} className="text-gray-300 font-mono">
                      {i + 1}×: {h} Hz
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#1a1d23] rounded p-3">
                <div className="text-gray-400 mb-2">各测点物理量</div>
                <div className="space-y-2">
                  {recordPhysics.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        'rounded p-2 border',
                        getThresholdLevelBg(r.threshold.level),
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-300 font-mono text-xs">
                          {r.frequencyHz} Hz / {r.direction}
                        </span>
                        <span className={cn('text-xs font-medium', getThresholdLevelText(r.threshold.level))}>
                          {r.threshold.level}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs">
                        位移: <span className="text-white font-mono">{r.physics.displacementUm} μm</span>
                      </div>
                      <div className="text-gray-400 text-xs">
                        峰值: <span className="text-white font-mono">{r.physics.peakMmPerS} mm/s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
}
