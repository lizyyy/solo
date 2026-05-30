import type { Phrase } from '@/types/music';

export const DEFAULT_PHRASES: Phrase[] = [
  {
    id: 'phrase-001',
    name: 'C大调上行琶音',
    notes: [
      { pitch: 'C', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'E', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'B', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'easy',
    compatibleChords: ['c-maj7'],
    tags: ['琶音', '上行', 'C大调'],
  },
  {
    id: 'phrase-002',
    name: 'Dm7下行音阶',
    notes: [
      { pitch: 'A', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'F', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'D', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'easy',
    compatibleChords: ['d-min7'],
    tags: ['音阶', '下行', 'D小调'],
  },
  {
    id: 'phrase-003',
    name: 'G7引导音',
    notes: [
      { pitch: 'B', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'F', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'B', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'medium',
    compatibleChords: ['g-dom7'],
    tags: ['引导音', '属七', 'G7'],
  },
  {
    id: 'phrase-004',
    name: 'Cmaj7分解和弦',
    notes: [
      { pitch: 'E', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'C', octave: 5, accidental: 'natural', duration: 0.25 },
      { pitch: 'E', octave: 5, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'easy',
    compatibleChords: ['c-maj7', 'g-maj7'],
    tags: ['分解和弦', 'C大调'],
  },
  {
    id: 'phrase-005',
    name: 'Dm7经过音乐句',
    notes: [
      { pitch: 'D', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'E', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'F', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'A', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'medium',
    compatibleChords: ['d-min7', 'a-min7'],
    tags: ['经过音', 'D小调'],
  },
  {
    id: 'phrase-006',
    name: 'G7摇摆乐句',
    notes: [
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'B', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'D', octave: 5, accidental: 'natural', duration: 0.25 },
      { pitch: 'F', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'medium',
    compatibleChords: ['g-dom7', 'd-dom7'],
    tags: ['摇摆', '属七和弦'],
  },
  {
    id: 'phrase-007',
    name: 'C大调五声音阶',
    notes: [
      { pitch: 'C', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'D', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'E', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'easy',
    compatibleChords: ['c-maj7', 'g-maj7'],
    tags: ['五声音阶', 'C大调'],
  },
  {
    id: 'phrase-008',
    name: 'Am7小调乐句',
    notes: [
      { pitch: 'A', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'C', octave: 5, accidental: 'natural', duration: 0.25 },
      { pitch: 'E', octave: 5, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 5, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'medium',
    compatibleChords: ['a-min7', 'd-min7'],
    tags: ['小调', 'A小调'],
  },
  {
    id: 'phrase-009',
    name: 'Dm7-G7连接乐句',
    notes: [
      { pitch: 'F', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'G', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'A', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'B', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'hard',
    compatibleChords: ['d-min7', 'g-dom7'],
    tags: ['连接乐句', 'II-V'],
  },
  {
    id: 'phrase-010',
    name: 'Cmaj7 resolved',
    notes: [
      { pitch: 'B', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'C', octave: 5, accidental: 'natural', duration: 0.25 },
      { pitch: 'E', octave: 5, accidental: 'natural', duration: 0.25 },
      { pitch: 'C', octave: 5, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'medium',
    compatibleChords: ['c-maj7', 'g-maj7'],
    tags: ['解决', '终止'],
  },
  {
    id: 'phrase-011',
    name: '错误乐句-和弦外音',
    notes: [
      { pitch: 'C', octave: 4, accidental: 'natural', duration: 0.25 },
      { pitch: 'C#', octave: 4, accidental: '#', duration: 0.25 },
      { pitch: 'D#', octave: 4, accidental: '#', duration: 0.25 },
      { pitch: 'E', octave: 4, accidental: 'natural', duration: 0.25 },
    ],
    totalDuration: 1,
    difficulty: 'medium',
    compatibleChords: [],
    tags: ['错误示例', '和弦外音'],
  },
  {
    id: 'phrase-012',
    name: '超长乐句-超拍',
    notes: [
      { pitch: 'C', octave: 4, accidental: 'natural', duration: 0.5 },
      { pitch: 'D', octave: 4, accidental: 'natural', duration: 0.5 },
      { pitch: 'E', octave: 4, accidental: 'natural', duration: 0.5 },
      { pitch: 'F', octave: 4, accidental: 'natural', duration: 0.5 },
    ],
    totalDuration: 2,
    difficulty: 'easy',
    compatibleChords: ['c-maj7', 'd-min7'],
    tags: ['长乐句', '超拍示例'],
  },
];

export function getPhraseById(id: string): Phrase | undefined {
  return DEFAULT_PHRASES.find((phrase) => phrase.id === id);
}

export function getPhrasesByChord(chordId: string): Phrase[] {
  return DEFAULT_PHRASES.filter((phrase) => phrase.compatibleChords.includes(chordId));
}

export function getPhrasesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Phrase[] {
  return DEFAULT_PHRASES.filter((phrase) => phrase.difficulty === difficulty);
}
