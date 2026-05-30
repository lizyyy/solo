import type { ChordProgression, RhythmPattern } from '@/types/music';

export const DEFAULT_PROGRESSIONS: ChordProgression[] = [
  {
    id: 'prog-ii-v-i-c',
    name: 'C大调 II-V-I',
    totalMeasures: 4,
    chords: [
      { chordId: 'd-min7', measure: 1, beat: 1 },
      { chordId: 'g-dom7', measure: 2, beat: 1 },
      { chordId: 'c-maj7', measure: 3, beat: 1 },
      { chordId: 'c-maj7', measure: 4, beat: 1 },
    ],
  },
  {
    id: 'prog-ii-v-i-f',
    name: 'F大调 II-V-I',
    totalMeasures: 4,
    chords: [
      { chordId: 'g-min7', measure: 1, beat: 1 },
      { chordId: 'c-dom7', measure: 2, beat: 1 },
      { chordId: 'f-maj7', measure: 3, beat: 1 },
      { chordId: 'f-maj7', measure: 4, beat: 1 },
    ],
  },
  {
    id: 'prog-i-vi-ii-v-c',
    name: 'C大调 I-VI-II-V',
    totalMeasures: 4,
    chords: [
      { chordId: 'c-maj7', measure: 1, beat: 1 },
      { chordId: 'a-min7', measure: 2, beat: 1 },
      { chordId: 'd-min7', measure: 3, beat: 1 },
      { chordId: 'g-dom7', measure: 4, beat: 1 },
    ],
  },
  {
    id: 'prog-blues-c',
    name: 'C大调 12小节布鲁斯',
    totalMeasures: 12,
    chords: [
      { chordId: 'c-dom7', measure: 1, beat: 1 },
      { chordId: 'c-dom7', measure: 2, beat: 1 },
      { chordId: 'c-dom7', measure: 3, beat: 1 },
      { chordId: 'c-dom7', measure: 4, beat: 1 },
      { chordId: 'f-dom7', measure: 5, beat: 1 },
      { chordId: 'f-dom7', measure: 6, beat: 1 },
      { chordId: 'c-dom7', measure: 7, beat: 1 },
      { chordId: 'c-dom7', measure: 8, beat: 1 },
      { chordId: 'g-dom7', measure: 9, beat: 1 },
      { chordId: 'f-dom7', measure: 10, beat: 1 },
      { chordId: 'c-dom7', measure: 11, beat: 1 },
      { chordId: 'g-dom7', measure: 12, beat: 1 },
    ],
  },
  {
    id: 'prog-autumn-leaves',
    name: '秋叶进行 (G小调)',
    totalMeasures: 8,
    chords: [
      { chordId: 'g-min7', measure: 1, beat: 1 },
      { chordId: 'c-dom7', measure: 2, beat: 1 },
      { chordId: 'f-maj7', measure: 3, beat: 1 },
      { chordId: 'bb-maj7', measure: 4, beat: 1 },
      { chordId: 'e-min7b5', measure: 5, beat: 1 },
      { chordId: 'a-dom7b9', measure: 6, beat: 1 },
      { chordId: 'd-min7', measure: 7, beat: 1 },
      { chordId: 'g-dom7', measure: 8, beat: 1 },
    ],
  },
];

export const DEFAULT_RHYTHMS: RhythmPattern[] = [
  {
    id: 'rhythm-44-100',
    timeSignature: [4, 4],
    bpm: 100,
    swingFactor: 0,
  },
  {
    id: 'rhythm-44-120',
    timeSignature: [4, 4],
    bpm: 120,
    swingFactor: 0.3,
  },
  {
    id: 'rhythm-44-140',
    timeSignature: [4, 4],
    bpm: 140,
    swingFactor: 0.5,
  },
  {
    id: 'rhythm-34-90',
    timeSignature: [3, 4],
    bpm: 90,
    swingFactor: 0,
  },
  {
    id: 'rhythm-44-160-fast',
    timeSignature: [4, 4],
    bpm: 160,
    swingFactor: 0.4,
  },
];

export function getProgressionById(id: string): ChordProgression | undefined {
  return DEFAULT_PROGRESSIONS.find((p) => p.id === id);
}

export function getRhythmById(id: string): RhythmPattern | undefined {
  return DEFAULT_RHYTHMS.find((r) => r.id === id);
}

export function getChordAtMeasure(
  progression: ChordProgression,
  measure: number
): string | null {
  const chordEntry = progression.chords
    .filter((c) => c.measure <= measure)
    .sort((a, b) => b.measure - a.measure)[0];
  return chordEntry?.chordId || null;
}
