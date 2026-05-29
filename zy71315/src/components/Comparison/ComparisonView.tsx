import { useState } from 'react';
import { X, ArrowDownUp, GitCompare, TrendingUp } from 'lucide-react';
import type { Experiment, Peak } from '../../types';
import { SpectrumChart } from '../Spectrum/SpectrumChart';
import { comparisonColors } from '../../utils/mockData';

interface ComparisonViewProps {
  experiments: Experiment[];
  onClose: () => void;
  onRemoveExperiment: (id: string) => void;
}

export function ComparisonView({
  experiments,
  onClose,
  onRemoveExperiment,
}: ComparisonViewProps) {
  const [showPeaks, setShowPeaks] = useState(true);

  const peakComparisons = experiments.length >= 2 ? comparePeaks(experiments[0], experiments[1]) : [];

  return (
    <div className="fixed inset-0 z-50 bg-dark-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-dark-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary-400" />
            <h2 className="font-display text-lg font-semibold text-dark-100">实验对比分析</h2>
            <span className="text-xs text-dark-400">({experiments.length} 个实验)</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {experiments.map((exp, index) => (
              <div
                key={exp.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: `${comparisonColors[index % comparisonColors.length]}20` }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: comparisonColors[index % comparisonColors.length] }}
                />
                <span className="text-sm text-dark-100">{exp.name}</span>
                <button
                  onClick={() => onRemoveExperiment(exp.id)}
                  className="p-1 rounded hover:bg-dark-700/50 text-dark-400 hover:text-dark-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-dark-200">频谱图对比</h3>
              <label className="flex items-center gap-2 text-xs text-dark-400">
                <input
                  type="checkbox"
                  checked={showPeaks}
                  onChange={(e) => setShowPeaks(e.target.checked)}
                  className="rounded border-dark-500 bg-dark-700 text-primary-500"
                />
                显示峰值
              </label>
            </div>
            <div className="bg-dark-700/30 rounded-lg p-4">
              <SpectrumChart experiments={experiments} showPeaks={showPeaks} height={350} />
            </div>
          </div>

          {peakComparisons.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4 text-accent-400" />
                峰值差异分析
              </h3>
              <div className="grid gap-3">
                {peakComparisons.map((comparison, index) => (
                  <PeakComparisonCard key={index} comparison={comparison} />
                ))}
              </div>
            </div>
          )}

          {experiments.length >= 2 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                总体差异指标
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="频率偏移"
                  value={calculateFrequencyShift(experiments[0], experiments[1])}
                  unit="Hz"
                />
                <MetricCard
                  label="幅度差异"
                  value={calculateAmplitudeDiff(experiments[0], experiments[1])}
                  unit="dB"
                />
                <MetricCard
                  label="Q值变化"
                  value={calculateQFactorDiff(experiments[0], experiments[1])}
                  unit="%"
                />
                <MetricCard
                  label="峰值数量变化"
                  value={experiments[1].peaks.length - experiments[0].peaks.length}
                  unit=""
                  showSign
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PeakComparison {
  peakA: Peak | null;
  peakB: Peak | null;
  freqDiff: number;
  ampDiff: number;
  matched: boolean;
}

function comparePeaks(expA: Experiment, expB: Experiment): PeakComparison[] {
  const validPeaksA = expA.peaks.filter((p) => !p.isNoise);
  const validPeaksB = expB.peaks.filter((p) => !p.isNoise);
  const comparisons: PeakComparison[] = [];
  const matchedB = new Set<string>();

  validPeaksA.forEach((peakA) => {
    let bestMatch: Peak | null = null;
    let minDiff = Infinity;

    validPeaksB.forEach((peakB) => {
      if (matchedB.has(peakB.id)) return;
      const diff = Math.abs(peakA.frequency - peakB.frequency);
      if (diff < minDiff && diff < 50) {
        minDiff = diff;
        bestMatch = peakB;
      }
    });

    if (bestMatch) {
      matchedB.add(bestMatch.id);
      comparisons.push({
        peakA,
        peakB: bestMatch,
        freqDiff: bestMatch.frequency - peakA.frequency,
        ampDiff: bestMatch.amplitude - peakA.amplitude,
        matched: true,
      });
    } else {
      comparisons.push({
        peakA,
        peakB: null,
        freqDiff: 0,
        ampDiff: 0,
        matched: false,
      });
    }
  });

  validPeaksB.forEach((peakB) => {
    if (!matchedB.has(peakB.id)) {
      comparisons.push({
        peakA: null,
        peakB,
        freqDiff: 0,
        ampDiff: 0,
        matched: false,
      });
    }
  });

  return comparisons;
}

function PeakComparisonCard({ comparison }: { comparison: PeakComparison }) {
  if (!comparison.matched) {
    return (
      <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600">
        <div className="flex items-center gap-2 text-xs text-dark-400">
          {comparison.peakA && (
            <span className="text-primary-400">
              仅在实验A: {comparison.peakA.frequency.toFixed(1)} Hz
            </span>
          )}
          {comparison.peakB && (
            <span className="text-purple-400">
              仅在实验B: {comparison.peakB.frequency.toFixed(1)} Hz
            </span>
          )}
        </div>
      </div>
    );
  }

  const { peakA, peakB, freqDiff, ampDiff } = comparison;
  if (!peakA || !peakB) return null;

  return (
    <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-primary-400">{peakA.frequency.toFixed(1)} Hz</span>
          <ArrowDownUp className="w-4 h-4 text-dark-500" />
          <span className="text-sm font-mono text-purple-400">{peakB.frequency.toFixed(1)} Hz</span>
        </div>
        <span
          className={`text-xs font-medium ${
            Math.abs(freqDiff) > 5 ? 'text-status-noise' : 'text-status-confirmed'
          }`}
        >
          {freqDiff > 0 ? '+' : ''}
          {freqDiff.toFixed(1)} Hz
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-dark-400">
        <span>
          幅度: {peakA.amplitude.toFixed(1)} → {peakB.amplitude.toFixed(1)} dB
          <span
            className={`ml-2 ${ampDiff > 0 ? 'text-status-confirmed' : 'text-status-noise'}`}
          >
            ({ampDiff > 0 ? '+' : ''}
            {ampDiff.toFixed(1)})
          </span>
        </span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  showSign = false,
}: {
  label: string;
  value: number;
  unit: string;
  showSign?: boolean;
}) {
  return (
    <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 text-center">
      <div className="text-xs text-dark-400 mb-1">{label}</div>
      <div
        className={`text-lg font-mono font-semibold ${
          value > 0 ? 'text-status-confirmed' : value < 0 ? 'text-status-noise' : 'text-dark-200'
        }`}
      >
        {showSign && value > 0 ? '+' : ''}
        {value.toFixed(1)}
        <span className="text-xs font-normal text-dark-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function calculateFrequencyShift(expA: Experiment, expB: Experiment): number {
  const peaksA = expA.peaks.filter((p) => !p.isNoise);
  const peaksB = expB.peaks.filter((p) => !p.isNoise);
  if (peaksA.length === 0 || peaksB.length === 0) return 0;
  return Math.abs(peaksA[0].frequency - peaksB[0].frequency);
}

function calculateAmplitudeDiff(expA: Experiment, expB: Experiment): number {
  const peaksA = expA.peaks.filter((p) => !p.isNoise);
  const peaksB = expB.peaks.filter((p) => !p.isNoise);
  if (peaksA.length === 0 || peaksB.length === 0) return 0;
  return peaksB[0].amplitude - peaksA[0].amplitude;
}

function calculateQFactorDiff(expA: Experiment, expB: Experiment): number {
  const qA = expA.peaks.filter((p) => !p.isNoise)[0]?.qFactor || 0;
  const qB = expB.peaks.filter((p) => !p.isNoise)[0]?.qFactor || 0;
  if (qA === 0) return 0;
  return ((qB - qA) / qA) * 100;
}
