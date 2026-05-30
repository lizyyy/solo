import type { Key } from '../../shared/types';

export const VALID_KEYS: Key[] = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

export const KEY_TO_SEMITONE: Record<Key, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
  'A#': 10, 'Bb': 10, 'B': 11,
};

export const SEMITONE_TO_KEY: Record<number, Key> = {
  0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
  6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B',
};

export const isValidKey = (key: string): key is Key => {
  return VALID_KEYS.includes(key as Key);
};

export const suggestSimilarKey = (invalidKey: string): string => {
  const upperKey = invalidKey.toUpperCase();
  const keyMap: Record<string, string> = {
    'H': 'B', 'H#': 'C', 'HB': 'Bb',
    'DO': 'C', 'RE': 'D', 'MI': 'E', 'FA': 'F', 'SOL': 'G', 'LA': 'A', 'SI': 'B',
    '1': 'C', '2': 'D', '3': 'E', '4': 'F', '5': 'G', '6': 'A', '7': 'B',
  };

  if (keyMap[upperKey]) return keyMap[upperKey];

  const firstChar = upperKey[0];
  if (firstChar >= 'A' && firstChar <= 'G') {
    if (invalidKey.length > 1) {
      const secondChar = invalidKey[1];
      if (secondChar === '#' || secondChar === 'b') {
        return firstChar + secondChar;
      }
    }
    return firstChar;
  }

  const editDistance = (a: string, b: string): number => {
    const dp: number[][] = Array(a.length + 1).fill(0).map(() => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[a.length][b.length];
  };

  let closest = 'C';
  let minDist = Infinity;
  for (const key of VALID_KEYS) {
    const dist = editDistance(upperKey, key);
    if (dist < minDist) {
      minDist = dist;
      closest = key;
    }
  }

  return closest;
};

export const getSemitoneDifference = (from: Key, to: Key): number => {
  const fromSemitone = KEY_TO_SEMITONE[from];
  const toSemitone = KEY_TO_SEMITONE[to];
  let diff = toSemitone - fromSemitone;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
};

export const transposeNote = (note: string, semitones: number): string => {
  const octaveMatch = note.match(/(\d+)/);
  const noteMatch = note.match(/^([A-G][#b]?)/);
  if (!noteMatch) return note;

  const notePart = noteMatch[1] as Key;
  const octave = octaveMatch ? parseInt(octaveMatch[1]) : 4;

  if (!isValidKey(notePart)) return note;

  let semitone = KEY_TO_SEMITONE[notePart] + semitones;
  let newOctave = octave;

  while (semitone < 0) {
    semitone += 12;
    newOctave--;
  }
  while (semitone > 11) {
    semitone -= 12;
    newOctave++;
  }

  const newNote = SEMITONE_TO_KEY[semitone];
  return `${newNote}${newOctave}`;
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const GUITAR_TUNING_COMPATIBILITY: Record<string, string[]> = {
  'Standard': ['E', 'A', 'D', 'G', 'B', 'F#', 'Gb', 'G#', 'Ab', 'C', 'D#', 'Eb'],
  'Drop D': ['D', 'G', 'C', 'F', 'A', 'D#', 'Eb', 'G#', 'Ab', 'C#', 'Db', 'A#', 'Bb'],
  'DADGAD': ['D', 'G', 'A', 'C', 'F', 'D#', 'Eb', 'G#', 'Ab'],
  'Open G': ['G', 'C', 'D', 'E', 'G#', 'Ab', 'A#', 'Bb'],
  'Open D': ['D', 'G', 'A', 'F#', 'Gb', 'B', 'C#', 'Db'],
  'Half Step Down': ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb', 'B', 'E'],
  'Full Step Down': ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb', 'D#', 'G#', 'Ab'],
};

export const isTuningCompatible = (tuning: string, key: Key): boolean => {
  const compatibleKeys = GUITAR_TUNING_COMPATIBILITY[tuning] || GUITAR_TUNING_COMPATIBILITY['Standard'];
  return compatibleKeys.includes(key);
};

export const getTuningSuggestion = (tuning: string, key: Key): string => {
  const semitones = getSemitoneDifference('E', key);
  if (Math.abs(semitones) <= 2) {
    return `建议使用变调夹 ${Math.abs(semitones)} 品`;
  }
  return `建议考虑将调号调整为 ${isTuningCompatible(tuning, 'D') ? 'D' : 'C'} 调以适配 ${tuning} 调弦`;
};
