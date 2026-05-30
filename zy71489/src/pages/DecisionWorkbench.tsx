import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Info, Music } from 'lucide-react';
import type { TrackWithRelations, FilterCriteria, Stats } from '@shared/types';
import { cn } from '@/lib/utils';
import StatsBar from '@/components/StatsBar';
import FilterPanel from '@/components/FilterPanel';
import TrackCard from '@/components/TrackCard';

const mockTracks: TrackWithRelations[] = [
  {
    id: '1',
    name: '夜空中最亮的星',
    artist: '逃跑计划',
    duration: 256,
    staminaLevel: 3,
    voteCount: 1247,
    isSelected: true,
    copyright: {
      id: 'c1',
      trackId: '1',
      trackName: '夜空中最亮的星',
      status: 'active',
      warningLevel: 'low',
      licenseNumber: 'CP-2024-00123',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 5, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-10 09:00' },
    createdAt: '2024-05-10',
    updatedAt: '2024-05-10'
  },
  {
    id: '2',
    name: '海阔天空',
    artist: 'Beyond',
    duration: 326,
    staminaLevel: 4,
    voteCount: 2891,
    isSelected: true,
    copyright: {
      id: 'c2',
      trackId: '2',
      trackName: '海阔天空',
      status: 'expired',
      warningLevel: 'high',
      expiredAt: '2024-03-15',
      licenseNumber: 'CP-2022-08901',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 12, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 8, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12',
    updatedAt: '2024-05-12'
  },
  {
    id: '3',
    name: '光辉岁月',
    artist: 'Beyond',
    duration: 298,
    staminaLevel: 4,
    voteCount: 2156,
    isSelected: false,
    copyright: {
      id: 'c3',
      trackId: '3',
      trackName: '光辉岁月',
      status: 'active',
      warningLevel: 'low',
      licenseNumber: 'CP-2024-00124',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 15, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 15, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12',
    updatedAt: '2024-05-12'
  },
  {
    id: '4',
    name: '晴天',
    artist: '周杰伦',
    duration: 269,
    staminaLevel: 2,
    voteCount: 3542,
    isSelected: false,
    copyright: {
      id: 'c4',
      trackId: '4',
      trackName: '晴天',
      status: 'pending',
      warningLevel: 'medium',
      licenseNumber: 'CP-2024-00567',
      source: { sourceType: 'api', importedBy: 'system', importedAt: '2024-05-18 08:00' },
      updatedAt: '2024-05-18'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-11 11:30' },
    createdAt: '2024-05-11',
    updatedAt: '2024-05-11'
  },
  {
    id: '5',
    name: '稻香',
    artist: '周杰伦',
    duration: 223,
    staminaLevel: 2,
    voteCount: 1876,
    isSelected: false,
    copyright: {
      id: 'c5',
      trackId: '5',
      trackName: '稻香',
      status: 'active',
      warningLevel: 'low',
      licenseNumber: 'CP-2024-00568',
      source: { sourceType: 'api', importedBy: 'system', importedAt: '2024-05-18 08:00' },
      updatedAt: '2024-05-18'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 23, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12',
    updatedAt: '2024-05-12'
  },
  {
    id: '6',
    name: '倔强',
    artist: '五月天',
    duration: 275,
    staminaLevel: 3,
    voteCount: 1654,
    isSelected: false,
    copyright: {
      id: 'c6',
      trackId: '6',
      trackName: '倔强',
      status: 'active',
      warningLevel: 'low',
      licenseNumber: 'CP-2024-00789',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 28, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-13 16:45' },
    createdAt: '2024-05-13',
    updatedAt: '2024-05-13'
  }
];

const mockStats: Stats = {
  totalTracks: 156,
  totalVotes: 12847,
  expiredCopyrights: 3,
  selectedCount: 2,
  totalDuration: 582,
  totalSelectedVotes: 4138,
  avgStamina: 3.5,
  hasCopyrightRisk: true
};

export default function DecisionWorkbench() {
  const [tracks, setTracks] = useState<TrackWithRelations[]>(mockTracks);
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [stats, setStats] = useState<Stats>(mockStats);
  const [isSaving, setIsSaving] = useState(false);

  const selectedTracks = tracks.filter(t => t.isSelected);

  const updateStats = useCallback((currentTracks: TrackWithRelations[]) => {
    const selected = currentTracks.filter(t => t.isSelected);
    const totalDuration = selected.reduce((sum, t) => sum + t.duration, 0);
    const totalVotes = selected.reduce((sum, t) => sum + t.voteCount, 0);
    const avgStamina = selected.length > 0
      ? selected.reduce((sum, t) => sum + t.staminaLevel, 0) / selected.length
      : 0;
    const hasRisk = selected.some(t => t.copyright?.status === 'expired');
    const riskCount = selected.filter(t => t.copyright?.status === 'expired').length;

    setStats(prev => ({
      ...prev,
      selectedCount: selected.length,
      totalDuration,
      totalSelectedVotes: totalVotes,
      avgStamina,
      hasCopyrightRisk: hasRisk,
      expiredCopyrights: riskCount
    }));
  }, []);

  const handleSelect = async (trackId: string, selected: boolean) => {
    const updatedTracks = tracks.map(t =>
      t.id === trackId ? { ...t, isSelected: selected } : t
    );
    setTracks(updatedTracks);
    updateStats(updatedTracks);

    try {
      await fetch('/api/decisions/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, selected })
      });
    } catch (e) {
      console.error('Failed to update selection:', e);
    }
  };

  const handleReset = () => {
    const reset = tracks.map(t => ({ ...t, isSelected: false }));
    setTracks(reset);
    updateStats(reset);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '返场曲单 ' + new Date().toLocaleDateString(),
          selectedTrackIds: selectedTracks.map(t => t.id),
          totalDuration: stats.totalDuration,
          totalVotes: stats.totalSelectedVotes,
          avgStamina: stats.avgStamina,
          copyrightRisk: stats.hasCopyrightRisk ? 'high' : 'none',
          filters,
          deduplicationRules: [{ field: 'voterId', enabled: true }]
        })
      });
    } catch (e) {
      console.error('Failed to save decision:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTracks = tracks.filter(track => {
    if (filters.searchKeyword) {
      const keyword = filters.searchKeyword.toLowerCase();
      if (!track.name.toLowerCase().includes(keyword) &&
          !track.artist.toLowerCase().includes(keyword)) {
        return false;
      }
    }
    if (filters.copyrightStatus && filters.copyrightStatus.length > 0) {
      if (!track.copyright || !filters.copyrightStatus.includes(track.copyright.status as 'active' | 'pending')) {
        return false;
      }
    }
    if (filters.minVotes && track.voteCount < filters.minVotes) {
      return false;
    }
    if (filters.maxDuration && track.duration > filters.maxDuration) {
      return false;
    }
    if (filters.maxStamina && track.staminaLevel > filters.maxStamina) {
      return false;
    }
    return true;
  });

  const expiredInSelection = selectedTracks.filter(t => t.copyright?.status === 'expired');

  return (
    <div className="p-6 min-h-full">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-white mb-2">决策工作台</h1>
        <p className="text-neutral-400 text-sm">综合考量投票数据、版权状态和乐手体力，制定最优返场曲单</p>
      </div>

      <StatsBar
        selectedCount={stats.selectedCount}
        totalDuration={stats.totalDuration}
        totalVotes={stats.totalSelectedVotes}
        avgStamina={stats.avgStamina}
        hasCopyrightRisk={stats.hasCopyrightRisk}
        copyrightRiskCount={stats.expiredCopyrights}
      />

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-3">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters({})}
          />
        </div>

        <div className="col-span-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-white">
                候选曲目
                <span className="ml-2 text-sm font-mono text-neutral-500">
                  ({filteredTracks.length} 首)
                </span>
              </h2>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredTracks.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <Music size={48} className="mx-auto mb-4 opacity-30" />
                  <p>没有找到符合条件的曲目</p>
                </div>
              ) : (
                filteredTracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <TrackCard
                      track={track}
                      onSelect={handleSelect}
                      disabled={track.copyright?.status === 'expired' && !track.isSelected}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <div className="card-stage p-5 sticky top-4 space-y-5">
            <h2 className="font-serif text-lg font-semibold text-gold">已选曲目</h2>

            {selectedTracks.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-sm">
                <Info size={32} className="mx-auto mb-3 opacity-30" />
                <p>暂未选择任何曲目</p>
                <p className="mt-1">点击左侧曲目卡片进行选择</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedTracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-stage border border-neutral-700/50 animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{track.name}</p>
                      <p className="text-xs text-neutral-500 truncate">{track.artist}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-mono text-xs text-gold">
                        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </p>
                      {track.copyright?.status === 'expired' && (
                        <span className="text-xs text-red animate-pulse-red">版权过期</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expiredInSelection.length > 0 && (
              <div className="bg-red/10 border border-red/30 rounded-stage p-3 animate-pulse-red">
                <p className="text-xs text-red font-medium mb-1">⚠️ 版权风险提示</p>
                <p className="text-xs text-red/80">
                  已选曲目中有 {expiredInSelection.length} 首歌曲版权已过期，建议更换
                </p>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-neutral-800">
              <button
                onClick={handleSave}
                disabled={selectedTracks.length === 0 || isSaving}
                className={cn(
                  'w-full btn-gold flex items-center justify-center gap-2',
                  selectedTracks.length === 0 && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Save size={16} />
                {isSaving ? '保存中...' : '保存决策'}
              </button>
              <button
                onClick={handleReset}
                className="w-full btn-stage flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                重置选择
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
