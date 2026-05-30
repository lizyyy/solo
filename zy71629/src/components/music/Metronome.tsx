import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import type { RhythmPattern } from '@/types/music';
import { playMetronomeClick } from '@/utils/audio';
import { Button } from '@/components/ui/Button';
import { getRhythmPatternDescription } from '@/engine/rhythmEngine';

interface MetronomeProps {
  pattern?: RhythmPattern;
  bpm?: number;
  timeSignature?: [number, number];
  autoStart?: boolean;
  onBeat?: (beat: number, measure: number) => void;
  compact?: boolean;
}

export const Metronome: React.FC<MetronomeProps> = ({
  pattern,
  bpm,
  timeSignature,
  autoStart = false,
  onBeat,
  compact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(autoStart);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentMeasure, setCurrentMeasure] = useState(1);
  const [muted, setMuted] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  const measureRef = useRef(1);

  const actualBpm = bpm ?? pattern?.bpm ?? 120;
  const actualTimeSignature = timeSignature ?? pattern?.timeSignature ?? [4, 4];

  const beatDuration = 60 / actualBpm * 1000;
  const beatsPerMeasure = actualTimeSignature[0];

  const tick = useCallback(() => {
    beatRef.current++;
    const beat = ((beatRef.current - 1) % beatsPerMeasure) + 1;
    const isAccent = beat === 1;

    if (isAccent && beatRef.current > 1) {
      measureRef.current++;
    }

    setCurrentBeat(beat);
    setCurrentMeasure(measureRef.current);

    if (!muted) {
      playMetronomeClick(isAccent, 0, 0.3);
    }

    onBeat?.(beat, measureRef.current);
  }, [beatsPerMeasure, muted, onBeat]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(tick, beatDuration);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, beatDuration, tick]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      if (isPlaying) {
        intervalRef.current = window.setInterval(tick, beatDuration);
      }
    }
  }, [beatDuration, isPlaying, tick]);

  const togglePlay = () => {
    if (!isPlaying) {
      beatRef.current = 0;
      measureRef.current = 1;
      setCurrentBeat(0);
      setCurrentMeasure(1);
    }
    setIsPlaying(!isPlaying);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 glass rounded-xl">
        <div className="flex gap-1">
          {Array.from({ length: beatsPerMeasure }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-100 ${
                currentBeat === i + 1
                  ? i === 0
                    ? 'bg-jazz-gold scale-125 animate-beat'
                    : 'bg-jazz-gold/70 scale-110'
                  : 'bg-jazz-border'
              }`}
            />
          ))}
        </div>
        <span className="text-jazz-textMuted text-sm font-mono">
          {pattern ? getRhythmPatternDescription(pattern) : `${actualTimeSignature[0]}/${actualTimeSignature[1]} @ ${actualBpm} BPM`}
        </span>
        <Button variant="ghost" size="sm" onClick={togglePlay}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMuted(!muted)}>
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="text-center mb-4">
        <h3 className="font-display text-lg text-jazz-gold mb-1">节拍器</h3>
        <p className="text-jazz-textMuted text-sm">
          {pattern ? getRhythmPatternDescription(pattern) : `${actualTimeSignature[0]}/${actualTimeSignature[1]} @ ${actualBpm} BPM`}
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {Array.from({ length: beatsPerMeasure }, (_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-100 ${
              currentBeat === i + 1
                ? i === 0
                  ? 'bg-jazz-gold text-jazz-bg scale-125 animate-beat shadow-lg shadow-jazz-gold/50'
                  : 'bg-jazz-gold/70 text-jazz-bg scale-110'
                : 'bg-jazz-bgLight text-jazz-textMuted border border-jazz-border'
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="flex justify-center items-center gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-display text-jazz-gold">{currentMeasure}</div>
          <div className="text-xs text-jazz-textMuted">小节</div>
        </div>
        <div className="w-px h-10 bg-jazz-border" />
        <div className="text-center">
          <div className="text-3xl font-display text-jazz-text">{actualBpm}</div>
          <div className="text-xs text-jazz-textMuted">BPM</div>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="primary" onClick={togglePlay} className="gap-2">
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" /> 停止
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> 开始
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={() => setMuted(!muted)}>
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};
