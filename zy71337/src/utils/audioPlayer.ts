import { Note } from '@/types';

const MIDI_TO_FREQ = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentTimeouts: number[] = [];

  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playNote(
    pitch: number,
    duration: number,
    startTime: number = 0,
    bpm: number = 120
  ): void {
    this.initAudioContext();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const freq = MIDI_TO_FREQ(pitch);
    const beatDuration = 60 / bpm;
    const noteDuration = duration * beatDuration;
    const noteStartTime = ctx.currentTime + startTime * beatDuration;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, noteStartTime);

    gainNode.gain.setValueAtTime(0, noteStartTime);
    gainNode.gain.linearRampToValueAtTime(0.3, noteStartTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      noteStartTime + noteDuration - 0.01
    );

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(noteStartTime);
    oscillator.stop(noteStartTime + noteDuration);
  }

  playNotes(notes: Note[], bpm: number = 120, onComplete?: () => void): void {
    this.stop();
    this.initAudioContext();
    this.isPlaying = true;

    let currentTime = 0;
    const beatDuration = 60 / bpm;

    for (const note of notes) {
      this.playNote(note.pitch, note.duration, currentTime, bpm);
      currentTime += note.duration;
    }

    const totalDuration = currentTime * beatDuration * 1000 + 500;
    const timeout = window.setTimeout(() => {
      this.isPlaying = false;
      if (onComplete) onComplete();
    }, totalDuration);
    this.currentTimeouts.push(timeout);
  }

  stop(): void {
    this.currentTimeouts.forEach((t) => clearTimeout(t));
    this.currentTimeouts = [];
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioPlayer = new AudioPlayer();
