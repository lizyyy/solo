export type DiameterUnit = 'inch' | 'cm';
export type TensionUnit = 'N/m' | 'lbf/in' | 'kgf/cm';
export type MaterialKey = 'mylar' | 'kevlar' | 'calf' | 'custom';

export interface MaterialInfo {
  key: MaterialKey;
  label: string;
  density: number;
  description: string;
}

export const MATERIALS: Record<MaterialKey, MaterialInfo> = {
  mylar: {
    key: 'mylar',
    label: 'Mylar 聚酯薄膜',
    density: 0.19,
    description: '最常见的鼓皮材质，适用于大多数军鼓和通鼓',
  },
  kevlar: {
    key: 'kevlar',
    label: 'Kevlar 芳纶纤维',
    density: 0.23,
    description: '高张力 marching 鼓皮，耐高温耐磨损',
  },
  calf: {
    key: 'calf',
    label: '小牛皮',
    density: 0.28,
    description: '传统材质，温暖音色，受温湿度影响较大',
  },
  custom: {
    key: 'custom',
    label: '自定义',
    density: 0.19,
    description: '自定义面密度值',
  },
};

export const TENSION_UNIT_FACTORS: Record<TensionUnit, number> = {
  'N/m': 1,
  'lbf/in': 175.13,
  'kgf/cm': 980.67,
};

export const DIAMETER_UNIT_FACTORS: Record<DiameterUnit, number> = {
  'inch': 0.0254,
  'cm': 0.01,
};

export const K01 = 2.4048;

export interface NoteInfo {
  name: string;
  freq: number;
  midi: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

export function freqToNoteName(freq: number): string {
  if (freq <= 0) return '--';
  const midi = freqToMidi(freq);
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToFreq(name: string): number | null {
  const match = name.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  if (noteIndex === -1) return null;
  const midi = (octave + 1) * 12 + noteIndex;
  return midiToFreq(midi);
}

export function getAllNotes(): NoteInfo[] {
  const notes: NoteInfo[] = [];
  for (let midi = 24; midi <= 108; midi++) {
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    notes.push({
      name: `${NOTE_NAMES[noteIndex]}${octave}`,
      freq: midiToFreq(midi),
      midi,
    });
  }
  return notes;
}

export const COMMON_DIAMETERS_INCH = [6, 8, 10, 12, 13, 14, 16, 18, 20, 22, 24, 26];
