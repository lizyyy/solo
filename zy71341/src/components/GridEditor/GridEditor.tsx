import React, { useMemo } from 'react';
import { usePatternStore } from '@/store/patternStore';
import { usePlayerStore } from '@/store/playerStore';
import { TrackRow } from './TrackRow';
import { Plus } from 'lucide-react';

const trackColors = ['#00F0FF', '#FF6B35', '#00FF88', '#FF3366', '#A855F7', '#FBBF24', '#EC4899', '#14B8A6'];

const defaultTrackNames = ['Kick', 'Snare', 'Hi-Hat', 'Clap', 'Tom', 'Crash', 'Ride', 'Open Hat'];

export const GridEditor: React.FC = () => {
  const {
    pattern,
    issues,
    filterTracks,
    toggleNote,
    setVelocity,
    toggleMute,
    toggleSolo,
    setTrackVolume,
    addTrack,
    removeTrack,
  } = usePatternStore();
  const { currentStep } = usePlayerStore();

  const issuesByTrackAndStep = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    issues.forEach((issue) => {
      if (issue.trackId) {
        if (!map.has(issue.trackId)) {
          map.set(issue.trackId, new Map());
        }
        map.get(issue.trackId)!.set(issue.step, issue.type);
      }
    });
    return map;
  }, [issues]);

  const handleAddTrack = () => {
    const nextIndex = pattern.tracks.length % defaultTrackNames.length;
    const colorIndex = pattern.tracks.length % trackColors.length;
    addTrack(defaultTrackNames[nextIndex], trackColors[colorIndex]);
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neon-blue">网格编辑器</h2>
        <button
          onClick={handleAddTrack}
          className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm text-neon-blue transition-colors"
        >
          <Plus size={16} />
          添加轨道
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="w-24" />
        <div className="w-24" />
        <div
          className="flex-1 grid gap-1 text-xs text-gray-500"
          style={{ gridTemplateColumns: `repeat(${pattern.steps}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: pattern.steps }, (_, i) => (
            <div
              key={i}
              className={`text-center ${currentStep === i ? 'text-neon-blue font-bold' : ''}`}
            >
              {i % 4 === 0 ? i + 1 : ''}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {pattern.tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            currentStep={currentStep}
            issuesByStep={issuesByTrackAndStep.get(track.id) || new Map()}
            onToggleNote={(step) => toggleNote(track.id, step)}
            onVelocityChange={(step, vel) => setVelocity(track.id, step, vel)}
            onToggleMute={() => toggleMute(track.id)}
            onToggleSolo={() => toggleSolo(track.id)}
            onRemove={() => removeTrack(track.id)}
            onVolumeChange={(vol) => setTrackVolume(track.id, vol)}
            isFiltered={filterTracks.length > 0 && !filterTracks.includes(track.id)}
          />
        ))}
      </div>
    </div>
  );
};
