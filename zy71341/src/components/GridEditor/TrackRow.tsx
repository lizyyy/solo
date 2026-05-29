import React from 'react';
import { DrumTrack } from '@/types';
import { StepCell } from './StepCell';
import { Volume2, VolumeX, Headphones, Trash2 } from 'lucide-react';

interface TrackRowProps {
  track: DrumTrack;
  currentStep: number;
  issuesByStep: Map<number, string>;
  onToggleNote: (step: number) => void;
  onVelocityChange: (step: number, velocity: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onRemove: () => void;
  onVolumeChange: (volume: number) => void;
  isFiltered: boolean;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  currentStep,
  issuesByStep,
  onToggleNote,
  onVelocityChange,
  onToggleMute,
  onToggleSolo,
  onRemove,
  onVolumeChange,
  isFiltered,
}) => {
  if (isFiltered) return null;

  return (
    <div className="flex items-center gap-2 py-1 group">
      <div
        className="w-24 flex items-center gap-2 px-2 py-1 rounded bg-dark-700"
        style={{ borderLeft: `3px solid ${track.color}` }}
      >
        <span className="text-sm font-medium truncate" style={{ color: track.color }}>
          {track.name}
        </span>
      </div>

      <div className="flex items-center gap-1 px-2">
        <button
          onClick={onToggleMute}
          className={`p-1 rounded transition-colors ${
            track.muted ? 'bg-neon-red text-white' : 'bg-dark-600 text-gray-400 hover:text-white'
          }`}
          title={track.muted ? '取消静音' : '静音'}
        >
          {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button
          onClick={onToggleSolo}
          className={`p-1 rounded transition-colors ${
            track.solo ? 'bg-neon-green text-dark-900' : 'bg-dark-600 text-gray-400 hover:text-white'
          }`}
          title={track.solo ? '取消独奏' : '独奏'}
        >
          <Headphones size={14} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-16 h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${track.color} 0%, ${track.color} ${track.volume * 100}%, #32324A ${track.volume * 100}%, #32324A 100%)`,
          }}
          title={`音量: ${Math.round(track.volume * 100)}%`}
        />
        <button
          onClick={onRemove}
          className="p-1 rounded bg-dark-600 text-gray-400 hover:text-neon-red opacity-0 group-hover:opacity-100 transition-opacity"
          title="删除轨道"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${track.notes.length}, minmax(0, 1fr))` }}>
        {track.notes.map((note) => (
          <StepCell
            key={note.id}
            note={note}
            trackColor={track.color}
            isActive={note.isActive && !track.muted}
            isCurrentStep={note.step === currentStep}
            hasIssue={issuesByStep.has(note.step)}
            issueType={issuesByStep.get(note.step)}
            onClick={() => onToggleNote(note.step)}
            onVelocityChange={(vel) => onVelocityChange(note.step, vel)}
          />
        ))}
      </div>
    </div>
  );
};
