import type { Note, Accidental } from '@/types/music';

const NOTE_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const SEMITONE_OFFSETS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ACCIDENTAL_VALUES: Record<Accidental, number> = {
  '#': 1,
  b: -1,
  natural: 0,
};

export function noteToMidi(note: Note): number {
  const baseOffset = SEMITONE_OFFSETS[note.pitch];
  const accidentalValue = ACCIDENTAL_VALUES[note.accidental];
  return (note.octave + 1) * 12 + baseOffset + accidentalValue;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteToFrequency(note: Note): number {
  return midiToFrequency(noteToMidi(note));
}

export function getNoteName(note: Note): string {
  const accidentalSymbol = note.accidental === 'natural' ? '' : note.accidental;
  return `${note.pitch}${accidentalSymbol}${note.octave}`;
}

export function getNoteSimpleName(note: Note): string {
  return note.pitch + note.accidental;
}

export function getInterval(note1: Note, note2: Note): number {
  return Math.abs(noteToMidi(note2) - noteToMidi(note1));
}

export function isSamePitch(note1: Note, note2: Note): boolean {
  return noteToMidi(note1) === noteToMidi(note2);
}

export function getDurationName(duration: number): string {
  const names: Record<number, string> = {
    1: '全音符',
    0.5: '二分音符',
    0.25: '四分音符',
    0.125: '八分音符',
    0.0625: '十六分音符',
  };
  return names[duration] || `${duration}拍`;
}

export function getChordQualityName(quality: string): string {
  const names: Record<string, string> = {
    maj: '大和弦',
    min: '小和弦',
    dom: '属和弦',
    dim: '减和弦',
    aug: '增和弦',
  };
  return names[quality] || quality;
}

export function transposeNote(note: Note, semitones: number): Note {
  const midi = noteToMidi(note) + semitones;
  const octave = Math.floor(midi / 12) - 1;
  const pitchClass = midi % 12;
  
  const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const pitchWithAccidental = pitchNames[pitchClass];
  
  let pitch: string;
  let accidental: Accidental;
  
  if (pitchWithAccidental.length === 1) {
    pitch = pitchWithAccidental;
    accidental = 'natural';
  } else {
    pitch = pitchWithAccidental[0];
    accidental = pitchWithAccidental[1] === '#' ? '#' : 'b';
  }
  
  return {
    pitch,
    octave,
    accidental,
    duration: note.duration,
  };
}

export function getScaleDegrees(root: string, scaleType: string): string[] {
  const rootIndex = NOTE_ORDER.indexOf(root);
  
  const majorScale = [0, 2, 4, 5, 7, 9, 11];
  const minorScale = [0, 2, 3, 5, 7, 8, 10];
  const dorian = [0, 2, 3, 5, 7, 9, 10];
  const mixolydian = [0, 2, 4, 5, 7, 9, 10];
  
  const intervals = scaleType === 'major' ? majorScale :
                    scaleType === 'minor' ? minorScale :
                    scaleType === 'dorian' ? dorian :
                    scaleType === 'mixolydian' ? mixolydian : majorScale;
  
  return intervals.map((interval) => {
    const noteIndex = (rootIndex + Math.floor(interval / 2)) % 7;
    const baseNote = NOTE_ORDER[noteIndex];
    const semitoneDiff = interval - (Math.floor(interval / 2) * 2);
    
    let accidental: Accidental = 'natural';
    if (interval === 3 || interval === 8 || interval === 10) {
      accidental = 'b';
    }
    
    return baseNote + accidental;
  });
}
