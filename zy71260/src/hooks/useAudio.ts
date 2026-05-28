import { useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { useAppStore } from '../store/useAppStore';
import { noteToMidi, midiToNote, getModeScale, getChordNotes } from '../utils/musicTheory';
import type { Mode, Chord, AudioSample } from '../types';

const useAudio = () => {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlaying = useAppStore((state) => state.setPlaying);

  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 0.8,
      },
    }).toDestination();

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  const playNotes = useCallback(async (notes: number[], duration: number = 0.5, delay: number = 0.1) => {
    if (!synthRef.current) return;

    await Tone.start();
    const now = Tone.now();

    notes.forEach((midiNote, index) => {
      const note = midiToNote(midiNote);
      synthRef.current?.triggerAttackRelease(
        note,
        duration,
        now + index * delay
      );
    });
  }, []);

  const playMode = useCallback(async (mode: Mode) => {
    if (!synthRef.current) return;

    setPlaying(true, mode.audioSampleId);
    await Tone.start();

    const scaleNotes = getModeScale(mode.rootNote, mode.type);
    const now = Tone.now();

    scaleNotes.forEach((midiNote, index) => {
      const note = midiToNote(midiNote);
      synthRef.current?.triggerAttackRelease(
        note,
        '8n',
        now + index * 0.3
      );
    });

    setTimeout(() => {
      setPlaying(false, null);
    }, scaleNotes.length * 300 + 500);
  }, [setPlaying]);

  const playChord = useCallback(async (chord: Chord) => {
    if (!synthRef.current) return;

    setPlaying(true, chord.audioSampleId);
    await Tone.start();

    const chordType = chord.function === 'leading' ? 'diminished' : 
                     chord.name.includes('m') ? 'minor' : 'major';
    const chordNotes = getChordNotes(chord.name.replace('m', ''), chordType);
    const now = Tone.now();

    chordNotes.forEach((midiNote) => {
      const note = midiToNote(midiNote);
      synthRef.current?.triggerAttackRelease(
        note,
        '2n',
        now
      );
    });

    setTimeout(() => {
      setPlaying(false, null);
    }, 1500);
  }, [setPlaying]);

  const playSample = useCallback(async (sample: AudioSample) => {
    if (!synthRef.current) return;

    setPlaying(true, sample.id);
    await Tone.start();

    const now = Tone.now();

    sample.notes.forEach((noteStr, index) => {
      const midiNote = noteToMidi(noteStr);
      const note = midiToNote(midiNote);
      synthRef.current?.triggerAttackRelease(
        note,
        '8n',
        now + index * 0.2
      );
    });

    setTimeout(() => {
      setPlaying(false, null);
    }, sample.notes.length * 200 + 500);
  }, [setPlaying]);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
    setPlaying(false, null);
  }, [setPlaying]);

  return {
    isPlaying,
    playMode,
    playChord,
    playSample,
    playNotes,
    stop,
  };
};

export default useAudio;
