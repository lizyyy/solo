import type { FrequencyCoverage } from '@/utils/types';
import { useHallStore } from '@/store/useHallStore';

interface FrequencyTableProps {
  zoneId: string;
}

export default function FrequencyTable({ zoneId }: FrequencyTableProps) {
  const frequencyCoverages = useHallStore((s) => s.frequencyCoverages);
  const setActiveFrequency = useHallStore((s) => s.setActiveFrequency);
  const activeFrequency = useHallStore((s) => s.activeFrequency);

  const zoneCoverages = frequencyCoverages.filter((c) => c.zoneId === zoneId);

  if (zoneCoverages.length === 0) return null;

  const getCoverageColor = (percent: number) => {
    if (percent >= 80) return 'text-green-400';
    if (percent >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h4 className="text-white font-semibold mb-3">频率覆盖</h4>
      <div className="space-y-2">
        {zoneCoverages.map((coverage) => (
          <div
            key={coverage.id}
            onClick={() => setActiveFrequency(coverage.frequency)}
            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
              activeFrequency === coverage.frequency
                ? 'bg-amber-500/20 border border-amber-500/50'
                : 'hover:bg-gray-700/50'
            }`}
          >
            <span className="text-gray-300 text-sm">{coverage.frequency} Hz</span>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getCoverageColor(coverage.coveragePercent).replace('text-', 'bg-')}`}
                  style={{ width: `${coverage.coveragePercent}%` }}
                />
              </div>
              <span className={`text-sm font-medium ${getCoverageColor(coverage.coveragePercent)}`}>
                {coverage.coveragePercent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
