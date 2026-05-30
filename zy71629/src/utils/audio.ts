import type { Note, Phrase, RhythmPattern } from '@/types/music';
import { noteToFrequency } from '@/engine/musicTheory';
import { estimateTimingData } from '@/engine/rhythmEngine';

let audioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    return ctx.resume();
  }
  return Promise.resolve();
}

export function playNote(
  note: Note,
  startTime: number = 0,
  duration: number = 0.5,
  volume: number = 0.3
): void {
  const ctx = getAudioContext();
  const frequency = noteToFrequency(note);
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);
  
  gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.01);
  gainNode.gain.setValueAtTime(volume, ctx.currentTime + startTime + duration * 0.7);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.start(ctx.currentTime + startTime);
  oscillator.stop(ctx.currentTime + startTime + duration);
}

export function playPhrase(
  phrase: Phrase,
  pattern: RhythmPattern,
  startTime: number = 0,
  volume: number = 0.3
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const timingData = estimateTimingData(phrase, pattern, 0, false);
    const beatDuration = 60 / pattern.bpm;
    const beatsPerMeasure = pattern.timeSignature[0];
    
    let maxEndTime = 0;
    
    phrase.notes.forEach((note, index) => {
      const noteStartTime = timingData[index] / (beatDuration * beatsPerMeasure);
      const noteDuration = note.duration * 0.9;
      
      playNote(note, startTime + noteStartTime, noteDuration, volume);
      maxEndTime = Math.max(maxEndTime, startTime + noteStartTime + noteDuration);
    });
    
    setTimeout(() => resolve(), (maxEndTime + 0.2) * 1000);
  });
}

export function playMetronomeClick(
  isAccent: boolean = false,
  startTime: number = 0,
  volume: number = 0.4
): void {
  const ctx = getAudioContext();
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = isAccent ? 'square' : 'sine';
  oscillator.frequency.setValueAtTime(isAccent ? 1000 : 800, ctx.currentTime + startTime);
  
  const duration = 0.05;
  gainNode.gain.setValueAtTime(volume, ctx.currentTime + startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.start(ctx.currentTime + startTime);
  oscillator.stop(ctx.currentTime + startTime + duration);
}

export function playChord(
  chordNotes: string[],
  octave: number = 4,
  startTime: number = 0,
  duration: number = 1,
  volume: number = 0.2
): void {
  chordNotes.forEach((noteName, index) => {
    const pitch = noteName.replace(/[#bnatural]/g, '');
    let accidental: '#' | 'b' | 'natural' = 'natural';
    if (noteName.includes('#')) accidental = '#';
    else if (noteName.includes('b')) accidental = 'b';
    
    const note: Note = {
      pitch,
      octave: octave + Math.floor(index / 3),
      accidental,
      duration: 1,
    };
    
    playNote(note, startTime + index * 0.03, duration, volume);
  });
}

export function playMeasure(
  phrase: Phrase,
  chordSymbol: string,
  chordNotes: string[],
  pattern: RhythmPattern,
  measureNumber: number = 1
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const measureDuration = pattern.timeSignature[0] * (60 / pattern.bpm);
    
    playChord(chordNotes, 3, 0, measureDuration, 0.15);
    playPhrase(phrase, pattern, 0, 0.3).then(() => {
      setTimeout(resolve, 100);
    });
  });
}

export function stopAllAudio(): void {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
