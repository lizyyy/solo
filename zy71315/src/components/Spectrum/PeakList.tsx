import { Check, X, AlertTriangle, Music, Waves } from 'lucide-react';
import type { Peak, DataStatus } from '../../types';

interface PeakListProps {
  peaks: Peak[];
  onToggleNoise: (peakId: string, isNoise: boolean) => void;
  onUpdateStatus: (peakId: string, status: DataStatus) => void;
}

export function PeakList({ peaks, onToggleNoise, onUpdateStatus }: PeakListProps) {
  const validPeaks = peaks.filter((p) => !p.isNoise);
  const noisePeaks = peaks.filter((p) => p.isNoise);

  return (
    <div className="space-y-4">
      {validPeaks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium text-dark-100">有效峰值</span>
            <span className="text-xs text-dark-400">({validPeaks.length})</span>
          </div>
          <div className="space-y-2">
            {validPeaks.map((peak) => (
              <PeakItem
                key={peak.id}
                peak={peak}
                onToggleNoise={onToggleNoise}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        </div>
      )}

      {noisePeaks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-status-noise" />
            <span className="text-sm font-medium text-dark-100">噪声峰值</span>
            <span className="text-xs text-dark-400">({noisePeaks.length})</span>
          </div>
          <div className="space-y-2 opacity-60">
            {noisePeaks.map((peak) => (
              <PeakItem
                key={peak.id}
                peak={peak}
                onToggleNoise={onToggleNoise}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        </div>
      )}

      {peaks.length === 0 && (
        <div className="text-center py-8 text-dark-400">
          <Waves className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">未检测到峰值</p>
        </div>
      )}
    </div>
  );
}

interface PeakItemProps {
  peak: Peak;
  onToggleNoise: (peakId: string, isNoise: boolean) => void;
  onUpdateStatus: (peakId: string, status: DataStatus) => void;
}

function PeakItem({ peak, onToggleNoise, onUpdateStatus }: PeakItemProps) {
  return (
    <div className="flex items-center justify-between p-2 bg-dark-700/50 rounded-lg border border-dark-600 hover:border-primary-500/30 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-primary-400 font-medium">
            {peak.frequency.toFixed(1)} Hz
          </span>
          <span
            className={`status-badge ${
              peak.status === 'confirmed' ? 'status-confirmed' : 'status-tentative'
            }`}
          >
            {peak.status === 'confirmed' ? '已确认' : '临时'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-dark-300">
          <span>幅度: {peak.amplitude.toFixed(1)} dB</span>
          {peak.qFactor && <span>Q值: {peak.qFactor.toFixed(1)}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdateStatus(peak.id, peak.status === 'confirmed' ? 'tentative' : 'confirmed')}
          className={`p-1.5 rounded transition-colors ${
            peak.status === 'confirmed'
              ? 'bg-status-confirmed/20 text-status-confirmed hover:bg-status-confirmed/30'
              : 'bg-dark-600 text-dark-300 hover:bg-dark-500'
          }`}
          title={peak.status === 'confirmed' ? '取消确认' : '标记为已确认'}
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onToggleNoise(peak.id, !peak.isNoise)}
          className={`p-1.5 rounded transition-colors ${
            peak.isNoise
              ? 'bg-status-noise/20 text-status-noise hover:bg-status-noise/30'
              : 'bg-dark-600 text-dark-300 hover:bg-dark-500'
          }`}
          title={peak.isNoise ? '恢复为有效峰' : '标记为噪声'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
