const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const FIFTHS_ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
const MODE_BRIGHTNESS: Record<string, number> = {
  lydian: 3,
  major: 2,
  mixolydian: 1,
  dorian: 0,
  aeolian: -1,
  phrygian: -2,
  locrian: -3,
};

export const noteToMidi = (note: string, octave: number = 4): number => {
  const cleanNote = note.replace(/\d/g, '');
  const sharpIndex = NOTE_NAMES.indexOf(cleanNote);
  const flatIndex = FLAT_NAMES.indexOf(cleanNote);
  const index = sharpIndex >= 0 ? sharpIndex : flatIndex;
  if (index < 0) return 60;
  return (octave + 1) * 12 + index;
};

export const midiToNote = (midi: number): string => {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
};

export const getFifthsPosition = (rootNote: string): number => {
  const cleanNote = rootNote.replace(/\d/g, '');
  let index = FIFTHS_ORDER.indexOf(cleanNote);
  if (index < 0) {
    const flatIndex = FLAT_NAMES.indexOf(cleanNote);
    if (flatIndex >= 0) {
      const enharmonicSharp = NOTE_NAMES[flatIndex];
      index = FIFTHS_ORDER.indexOf(enharmonicSharp);
    }
  }
  return index >= 0 ? index - 6 : 0;
};

export const getModeBrightness = (modeType: string): number => {
  return MODE_BRIGHTNESS[modeType] || 0;
};

export const getModeScale = (rootNote: string, modeType: string): number[] => {
  const rootMidi = noteToMidi(rootNote, 4);
  const intervals: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
  };
  const modeIntervals = intervals[modeType] || intervals.major;
  return modeIntervals.map(i => rootMidi + i);
};

export const getChordNotes = (rootNote: string, chordType: string = 'major'): number[] => {
  const rootMidi = noteToMidi(rootNote, 4);
  const chordTypes: Record<string, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    dominant7: [0, 4, 7, 10],
  };
  const intervals = chordTypes[chordType] || chordTypes.major;
  return intervals.map(i => rootMidi + i);
};

export const getFunctionLevel = (func: string): number => {
  const levels: Record<string, number> = {
    tonic: 3,
    submediant: 2,
    subdominant: 1,
    supertonic: 0,
    mediant: -1,
    dominant: -2,
    leading: -3,
  };
  return levels[func] || 0;
};

export const checkEnharmonicConfusion = (note1: string, note2: string): boolean => {
  const midi1 = noteToMidi(note1);
  const midi2 = noteToMidi(note2);
  return midi1 === midi2 && note1 !== note2;
};

export const checkModulationDistance = (fromKey: string, toKey: string): number => {
  const fromPos = getFifthsPosition(fromKey);
  const toPos = getFifthsPosition(toKey);
  return Math.abs(fromPos - toPos);
};

export const isValidModulation = (fromKey: string, toKey: string, type: string): { valid: boolean; reason?: string } => {
  const distance = checkModulationDistance(fromKey, toKey);
  
  if (type === 'direct' && distance > 4) {
    return { valid: false, reason: '直接转调距离过远，可能造成听觉断裂' };
  }
  if (type === 'enharmonic' && distance !== 6) {
    return { valid: false, reason: '等音转调应该在五度圈对位' };
  }
  return { valid: true };
};

export const calculatePosition = (
  fifthsPosition: number,
  functionLevel: number,
  brightness: number,
  scale: number = 2
): { x: number; y: number; z: number } => ({
  x: fifthsPosition * scale,
  y: functionLevel * scale * 0.5,
  z: brightness * scale,
});

export const getModeName = (root: string, type: string): string => {
  const typeNames: Record<string, string> = {
    major: '大调',
    minor: '小调',
    dorian: '多利亚',
    phrygian: '弗里吉亚',
    lydian: '利底亚',
    mixolydian: '混合利底亚',
    aeolian: '爱奥尼亚',
    locrian: '洛克里亚',
  };
  return `${root}${typeNames[type] || type}`;
};

export const getChordFunctionName = (func: string): string => {
  const names: Record<string, string> = {
    tonic: '主和弦 (I)',
    supertonic: '上主和弦 (ii)',
    mediant: '中和弦 (iii)',
    subdominant: '下属和弦 (IV)',
    dominant: '属和弦 (V)',
    submediant: '下中和弦 (vi)',
    leading: '导和弦 (vii°)',
  };
  return names[func] || func;
};

export const getModulationTypeName = (type: string): string => {
  const names: Record<string, string> = {
    direct: '直接转调',
    pivot: '中介和弦转调',
    sequential: '模进转调',
    enharmonic: '等音转调',
  };
  return names[type] || type;
};

export const getQualityName = (quality: string): string => {
  const names: Record<string, string> = {
    normal: '正常',
    borderline: '临界',
    error: '错误',
  };
  return names[quality] || quality;
};
