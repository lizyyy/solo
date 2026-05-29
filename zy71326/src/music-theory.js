const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const KEY_SIGNATURES = {
  'C': { sharps: 0, flats: 0, accidentals: [] },
  'G': { sharps: 1, flats: 0, accidentals: ['F#'] },
  'D': { sharps: 2, flats: 0, accidentals: ['F#', 'C#'] },
  'A': { sharps: 3, flats: 0, accidentals: ['F#', 'C#', 'G#'] },
  'E': { sharps: 4, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#'] },
  'B': { sharps: 5, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'] },
  'F#': { sharps: 6, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] },
  'C#': { sharps: 7, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'] },
  'F': { sharps: 0, flats: 1, accidentals: ['Bb'] },
  'Bb': { sharps: 0, flats: 2, accidentals: ['Bb', 'Eb'] },
  'Eb': { sharps: 0, flats: 3, accidentals: ['Bb', 'Eb', 'Ab'] },
  'Ab': { sharps: 0, flats: 4, accidentals: ['Bb', 'Eb', 'Ab', 'Db'] },
  'Db': { sharps: 0, flats: 5, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] },
  'Gb': { sharps: 0, flats: 6, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] },
  'Cb': { sharps: 0, flats: 7, accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'] }
};

const MINOR_KEYS = {
  'Am': 'C', 'Em': 'G', 'Bm': 'D', 'F#m': 'A', 'C#m': 'E', 'G#m': 'B',
  'Dm': 'F', 'Gm': 'Bb', 'Cm': 'Eb', 'Fm': 'Ab', 'Bbm': 'Db', 'Ebm': 'Gb'
};

const CHORD_QUALITIES = ['maj', 'min', 'm', 'dim', 'aug', '7', 'maj7', 'min7', 'm7', 'sus2', 'sus4', 'dim7', 'aug7'];

function normalizeNote(note) {
  if (!note) return null;
  note = note.trim();
  const match = note.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return null;
  
  const [, letter, accidental, rest] = match;
  let index = NOTE_NAMES.indexOf(letter + accidental);
  if (index === -1) {
    index = NOTE_NAMES_FLAT.indexOf(letter + accidental);
  }
  if (index === -1) {
    index = NOTE_NAMES.indexOf(letter);
  }
  
  return { index, letter, accidental, rest, original: note };
}

function noteIndexToName(index, preferSharps = true) {
  index = ((index % 12) + 12) % 12;
  return preferSharps ? NOTE_NAMES[index] : NOTE_NAMES_FLAT[index];
}

function getKeySemitones(key) {
  const normalized = normalizeNote(key);
  return normalized ? normalized.index : 0;
}

function calculateTransposeInterval(fromKey, toKey) {
  const fromSemitones = getKeySemitones(fromKey);
  const toSemitones = getKeySemitones(toKey);
  return ((toSemitones - fromSemitones) % 12 + 12) % 12;
}

function transposeNote(note, semitones, targetKeyInfo) {
  const normalized = normalizeNote(note);
  if (!normalized) return note;
  
  const newIndex = ((normalized.index + semitones) % 12 + 12) % 12;
  const preferSharps = targetKeyInfo.sharps > targetKeyInfo.flats;
  const newNoteName = noteIndexToName(newIndex, preferSharps);
  
  return newNoteName + normalized.rest;
}

function parseChord(chord) {
  if (!chord) return null;
  
  const rootMatch = chord.match(/^([A-G][#b]?)(.*)$/);
  if (rootMatch) {
    const [, rootName, quality] = rootMatch;
    const normalized = normalizeNote(rootName);
    if (normalized) {
      return { root: normalized, quality, original: chord };
    }
  }
  
  const letterMatch = chord.match(/^([A-G])(.*)$/);
  if (letterMatch) {
    return {
      root: normalizeNote(letterMatch[1]),
      quality: letterMatch[2],
      original: chord
    };
  }
  
  return { root: null, quality: '', original: chord, unparsed: true };
}

function transposeChord(chord, semitones, targetKeyInfo) {
  const parsed = parseChord(chord);
  if (!parsed || !parsed.root) return chord;
  
  const newRootIndex = ((parsed.root.index + semitones) % 12 + 12) % 12;
  const preferSharps = targetKeyInfo.sharps > targetKeyInfo.flats;
  const newRoot = noteIndexToName(newRootIndex, preferSharps);
  
  return newRoot + parsed.quality;
}

function transposeNumberedNotation(number, semitones) {
  const num = parseInt(number, 10);
  if (isNaN(num)) return number;
  return ((num - 1 + Math.round(semitones / 2)) % 7 + 7) % 7 + 1;
}

function getKeyInfo(key) {
  if (MINOR_KEYS[key]) {
    return KEY_SIGNATURES[MINOR_KEYS[key]];
  }
  return KEY_SIGNATURES[key] || KEY_SIGNATURES['C'];
}

function detectAccidentalIssues(originalNote, transposedNote, context = {}) {
  const issues = [];
  const origNorm = normalizeNote(originalNote);
  const transNorm = normalizeNote(transposedNote);
  
  if (!origNorm || !transNorm) return issues;
  
  if (origNorm.accidental && !transNorm.accidental) {
    issues.push({
      type: 'accidental_removed',
      message: `注意：原音符 "${originalNote}" 的临时变音记号在移调后消失了`,
      severity: 'warning',
      context
    });
  }
  
  if (!origNorm.accidental && transNorm.accidental) {
    issues.push({
      type: 'accidental_added',
      message: `提示：原音符 "${originalNote}" 在移调后需要添加临时变音记号 "${transposedNote}"`,
      severity: 'info',
      context
    });
  }
  
  return issues;
}

module.exports = {
  NOTE_NAMES,
  NOTE_NAMES_FLAT,
  KEY_SIGNATURES,
  MINOR_KEYS,
  normalizeNote,
  noteIndexToName,
  getKeySemitones,
  calculateTransposeInterval,
  transposeNote,
  parseChord,
  transposeChord,
  transposeNumberedNotation,
  getKeyInfo,
  detectAccidentalIssues
};
