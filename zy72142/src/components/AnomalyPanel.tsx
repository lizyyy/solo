import { AlertTriangle, Clock, Copy, ShieldAlert } from 'lucide-react';
import type { AnomalyType } from '../types';
import { ANOMALY_LABELS } from '../types';

interface AnomalyPanelProps {
  stats: {
    total: number;
    normal: number;
    anomaly: number;
    expired_license: number;
    timecode_mismatch: number;
    duplicate_track: number;
  };
  selectedAnomaly: AnomalyType | 'all' | null;
  onSelect: (type: AnomalyType | 'all' | null) => void;
}

const anomalyIcons: Record<AnomalyType, React.ReactNode> = {
  expired_license: <ShieldAlert className="w-5 h-5" />,
  timecode_mismatch: <Clock className="w-5 h-5" />,
  duplicate_track: <Copy className="w-5 h-5" />,
};

const anomalyColors: Record<AnomalyType, string> = {
  expired_license: 'bg-red-50 border-red-200 text-red-700',
  timecode_mismatch: 'bg-amber-50 border-amber-200 text-amber-700',
  duplicate_track: 'bg-orange-50 border-orange-200 text-orange-700',
};

const anomalySelectedColors: Record<AnomalyType, string> = {
  expired_license: 'bg-red-500 text-white border-red-500',
  timecode_mismatch: 'bg-amber-500 text-white border-amber-500',
  duplicate_track: 'bg-orange-500 text-white border-orange-500',
};

export function AnomalyPanel({ stats, selectedAnomaly, onSelect }: AnomalyPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-[#E07A5F]" />
        <h2 className="font-semibold text-gray-800">异常检测</h2>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onSelect(selectedAnomaly === 'all' ? null : 'all')}
          className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
            selectedAnomaly === 'all'
              ? 'bg-[#1E3A3A] text-white border-[#1E3A3A]'
              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">全部异常</span>
            <span className={`px-2 py-0.5 rounded text-sm font-semibold ${
              selectedAnomaly === 'all' ? 'bg-white/20' : 'bg-[#E07A5F] text-white'
            }`}>
              {stats.anomaly}
            </span>
          </div>
        </button>

        {(Object.keys(ANOMALY_LABELS) as AnomalyType[]).map((type) => (
          <button
            key={type}
            onClick={() => onSelect(selectedAnomaly === type ? null : type)}
            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
              selectedAnomaly === type
                ? anomalySelectedColors[type]
                : anomalyColors[type] + ' hover:opacity-80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {anomalyIcons[type]}
                <span className="font-medium">{ANOMALY_LABELS[type]}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-sm font-semibold ${
                selectedAnomaly === type ? 'bg-white/20' : 'bg-white/60'
              }`}>
                {stats[type]}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">正常曲目</span>
          <span className="text-green-600 font-medium">{stats.normal}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-500">总曲目数</span>
          <span className="text-gray-700 font-medium">{stats.total}</span>
        </div>
      </div>
    </div>
  );
}
