import type { Chord } from '@/types/music';

export const DEFAULT_CHORDS: Chord[] = [
  {
    id: 'c-maj7',
    symbol: 'Cmaj7',
    root: 'C',
    quality: 'maj',
    extensions: ['7'],
    allowedNotes: ['Cnatural', 'Enatural', 'Gnatural', 'Bnatural'],
    passingNotes: ['Dnatural', 'Fnatural', 'Anatural'],
  },
  {
    id: 'd-min7',
    symbol: 'Dm7',
    root: 'D',
    quality: 'min',
    extensions: ['7'],
    allowedNotes: ['Dnatural', 'Fnatural', 'Anatural', 'Cnatural'],
    passingNotes: ['Enatural', 'Gnatural', 'Bnatural'],
  },
  {
    id: 'g-dom7',
    symbol: 'G7',
    root: 'G',
    quality: 'dom',
    extensions: ['7'],
    allowedNotes: ['Gnatural', 'Bnatural', 'Dnatural', 'Fnatural'],
    passingNotes: ['Anatural', 'Cnatural', 'Enatural'],
  },
  {
    id: 'a-min7',
    symbol: 'Am7',
    root: 'A',
    quality: 'min',
    extensions: ['7'],
    allowedNotes: ['Anatural', 'Cnatural', 'Enatural', 'Gnatural'],
    passingNotes: ['Bnatural', 'Dnatural', 'Fnatural'],
  },
  {
    id: 'd-dom7',
    symbol: 'D7',
    root: 'D',
    quality: 'dom',
    extensions: ['7'],
    allowedNotes: ['Dnatural', 'F#', 'Anatural', 'Cnatural'],
    passingNotes: ['Enatural', 'Gnatural', 'Bnatural'],
  },
  {
    id: 'g-maj7',
    symbol: 'Gmaj7',
    root: 'G',
    quality: 'maj',
    extensions: ['7'],
    allowedNotes: ['Gnatural', 'Bnatural', 'Dnatural', 'F#'],
    passingNotes: ['Anatural', 'Cnatural', 'Enatural'],
  },
  {
    id: 'c-min7',
    symbol: 'Cm7',
    root: 'C',
    quality: 'min',
    extensions: ['7'],
    allowedNotes: ['Cnatural', 'Eb', 'Gnatural', 'Bb'],
    passingNotes: ['Dnatural', 'Fnatural', 'Anatural'],
  },
  {
    id: 'f-dom7',
    symbol: 'F7',
    root: 'F',
    quality: 'dom',
    extensions: ['7'],
    allowedNotes: ['Fnatural', 'Anatural', 'Cnatural', 'Eb'],
    passingNotes: ['Gnatural', 'Bb', 'Dnatural'],
  },
  {
    id: 'bb-maj7',
    symbol: 'Bbmaj7',
    root: 'Bb',
    quality: 'maj',
    extensions: ['7'],
    allowedNotes: ['Bb', 'Dnatural', 'Fnatural', 'Anatural'],
    passingNotes: ['Cnatural', 'Eb', 'Gnatural'],
  },
  {
    id: 'e-min7b5',
    symbol: 'Em7b5',
    root: 'E',
    quality: 'dim',
    extensions: ['7b5'],
    allowedNotes: ['Enatural', 'Gnatural', 'Bb', 'Dnatural'],
    passingNotes: ['Fnatural', 'Anatural', 'Cnatural'],
  },
  {
    id: 'a-dom7b9',
    symbol: 'A7b9',
    root: 'A',
    quality: 'dom',
    extensions: ['7', 'b9'],
    allowedNotes: ['Anatural', 'C#', 'Enatural', 'Gnatural', 'Bb'],
    passingNotes: ['Bnatural', 'Dnatural', 'Fnatural'],
  },
  {
    id: 'd-min7b5',
    symbol: 'Dm7b5',
    root: 'D',
    quality: 'dim',
    extensions: ['7b5'],
    allowedNotes: ['Dnatural', 'Fnatural', 'Ab', 'Cnatural'],
    passingNotes: ['Enatural', 'Gnatural', 'Bb'],
  },
];

export function getChordById(id: string): Chord | undefined {
  return DEFAULT_CHORDS.find((chord) => chord.id === id);
}

export function getChordBySymbol(symbol: string): Chord | undefined {
  return DEFAULT_CHORDS.find((chord) => chord.symbol === symbol);
}
