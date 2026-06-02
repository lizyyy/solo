import { useShelterStore } from '../store/shelterStore';

export function useConflict() {
  const { conflicts, resolveConflict, getUnresolvedConflicts } = useShelterStore();

  const unresolvedConflicts = getUnresolvedConflicts();

  const stats = {
    total: conflicts.length,
    unresolved: unresolvedConflicts.length,
    resolved: conflicts.length - unresolvedConflicts.length,
    byType: {
      capacity: conflicts.filter(c => c.type === 'capacity').length,
      coordinate: conflicts.filter(c => c.type === 'coordinate').length,
      time: conflicts.filter(c => c.type === 'time').length,
      mixed: conflicts.filter(c => c.type === 'mixed').length
    }
  };

  const severityLabel = (severity: number) => {
    switch (severity) {
      case 1: return '低';
      case 2: return '中';
      case 3: return '高';
      case 4: return '极高';
      default: return '未知';
    }
  };

  const severityColor = (severity: number) => {
    switch (severity) {
      case 1: return 'bg-gray-400';
      case 2: return 'bg-yellow-500';
      case 3: return 'bg-orange-500';
      case 4: return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return {
    conflicts,
    unresolvedConflicts,
    stats,
    resolveConflict,
    severityLabel,
    severityColor
  };
}
