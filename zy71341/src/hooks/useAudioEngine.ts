import { useRef, useEffect, useCallback } from 'react';
import { Pattern, DrumTrack } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { usePatternStore } from '@/store/patternStore';

interface OscillatorCache {
  [key: string]: {
    frequency: number;
    type: OscillatorType;
  };
}

const drumOscillators: OscillatorCache = {
  kick: { frequency: 60, type: 'sine' },
  snare: { frequency: 200, type: 'triangle' },
  hihat: { frequency: 800, type: 'square' },
  clap: { frequency: 400, type: 'sawtooth' },
  tom: { frequency: 150, type: 'sine' },
  crash: { frequency: 500, type: 'sawtooth' },
  ride: { frequency: 600, type: 'square' },
  openhat: { frequency: 700, type: 'square' },
};

const getDrumConfig = (sampleUrl: string) => {
  const key = sampleUrl.toLowerCase() as keyof OscillatorCache;
  return drumOscillators[key] || { frequency: 200, type: 'sine' };
};

export const useAudioEngine = () => {
  const { audioContext, currentStep, setCurrentStep, isPlaying, setIsPlaying, isMetronomeEnabled } =
    usePlayerStore();
  const { pattern, filterTracks } = usePatternStore();
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const nextNoteTimeRef = useRef<number>(0);
  const scheduleAheadTime = 0.1;

  const playNote = useCallback(
    (track: DrumTrack, velocity: number, time: number) => {
      if (!audioContext || track.muted) return;

      const hasSolo = pattern.tracks.some((t) => t.solo);
      if (hasSolo && !track.solo) return;

      if (filterTracks.length > 0 && !filterTracks.includes(track.id)) return;

      const config = getDrumConfig(track.sampleUrl);
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();

      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, time);

      const normalizedVelocity = (velocity / 127) * track.volume;

      if (track.sampleUrl.toLowerCase().includes('kick')) {
        oscillator.frequency.exponentialRampToValueAtTime(30, time + 0.1);
        gainNode.gain.setValueAtTime(normalizedVelocity, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      } else if (track.sampleUrl.toLowerCase().includes('snare')) {
        filterNode.type = 'highpass';
        filterNode.frequency.value = 1000;
        gainNode.gain.setValueAtTime(normalizedVelocity * 0.5, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      } else if (track.sampleUrl.toLowerCase().includes('hat') || track.sampleUrl.toLowerCase().includes('hihat')) {
        filterNode.type = 'highpass';
        filterNode.frequency.value = 5000;
        gainNode.gain.setValueAtTime(normalizedVelocity * 0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      } else if (track.sampleUrl.toLowerCase().includes('clap')) {
        filterNode.type = 'bandpass';
        filterNode.frequency.value = 1500;
        gainNode.gain.setValueAtTime(normalizedVelocity * 0.4, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      } else {
        gainNode.gain.setValueAtTime(normalizedVelocity, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      }

      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(time);
      oscillator.stop(time + 0.5);
    },
    [audioContext, pattern.tracks, filterTracks]
  );

  const playMetronome = useCallback(
    (step: number, time: number) => {
      if (!audioContext || !isMetronomeEnabled) return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      const isDownbeat = step % 4 === 0;
      oscillator.frequency.value = isDownbeat ? 1000 : 800;

      gainNode.gain.setValueAtTime(0.15, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(time);
      oscillator.stop(time + 0.05);
    },
    [audioContext, isMetronomeEnabled]
  );

  const scheduler = useCallback(() => {
    if (!audioContext || !isPlaying) return;

    const secondsPerStep = 60 / pattern.bpm / 4;

    while (nextNoteTimeRef.current < audioContext.currentTime + scheduleAheadTime) {
      const step = Math.floor(
        ((nextNoteTimeRef.current - startTimeRef.current) / secondsPerStep) % pattern.steps
      );

      setCurrentStep(step);
      playMetronome(step, nextNoteTimeRef.current);

      pattern.tracks.forEach((track) => {
        const note = track.notes.find((n) => n.step === step && n.isActive);
        if (note) {
          playNote(track, note.velocity, nextNoteTimeRef.current);
        }
      });

      nextNoteTimeRef.current += secondsPerStep;
    }

    intervalRef.current = window.setTimeout(scheduler, 25);
  }, [audioContext, isPlaying, pattern, playNote, playMetronome, setCurrentStep]);

  const startPlayback = useCallback(() => {
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    startTimeRef.current = audioContext.currentTime;
    nextNoteTimeRef.current = audioContext.currentTime;
    setIsPlaying(true);
    scheduler();
  }, [audioContext, scheduler, setIsPlaying]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(-1);
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, [setIsPlaying, setCurrentStep]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPlaying && intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isPlaying]);

  return {
    startPlayback,
    stopPlayback,
    togglePlayback,
    playNote,
  };
};
