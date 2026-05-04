// 乐理基础工具函数

// 音符名称（含升降号）
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 大调调号（升号数）
const MAJOR_KEY_SIGNATURES = {
  'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6
};

// 小调调号（升号数，相对大调）
const MINOR_KEY_SIGNATURES = {
  'A': 0, 'E': 1, 'B': 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6,
  'D': -1, 'G': -2, 'C': -3, 'F': -4, 'Bb': -5, 'Eb': -6
};

// 音程（半音数）
const INTERVALS = {
  'unison': 0,
  'minor_2nd': 1,
  'major_2nd': 2,
  'minor_3rd': 3,
  'major_3rd': 4,
  'perfect_4th': 5,
  'augmented_4th': 6,
  'diminished_5th': 6,
  'perfect_5th': 7,
  'minor_6th': 8,
  'major_6th': 9,
  'minor_7th': 10,
  'major_7th': 11,
  'octave': 12
};

// 获取音符索引
const getNoteIndex = (note) => {
  const sharpIndex = NOTE_NAMES.indexOf(note);
  if (sharpIndex !== -1) return sharpIndex;
  const flatIndex = NOTE_NAMES_FLAT.indexOf(note);
  if (flatIndex !== -1) return flatIndex;
  return -1;
};

// 根据索引获取音符名称
const getNoteName = (index, useSharps = true) => {
  const normalizedIndex = ((index % 12) + 12) % 12;
  return useSharps ? NOTE_NAMES[normalizedIndex] : NOTE_NAMES_FLAT[normalizedIndex];
};

// 计算两个音符之间的半音数
const getSemitones = (note1, note2) => {
  const index1 = getNoteIndex(note1);
  const index2 = getNoteIndex(note2);
  if (index1 === -1 || index2 === -1) return null;
  return ((index2 - index1) % 12 + 12) % 12;
};

// 大调的音级（全全半全全全半）
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

// 小调的音级（自然小调：全半全全半全全）
const NATURAL_MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

// 和声小调
const HARMONIC_MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 11];

// 旋律小调（上行）
const MELODIC_MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 9, 11];

// 获取音阶的音级
const getScaleDegrees = (key, scaleType = 'major') => {
  const keyIndex = getNoteIndex(key);
  if (keyIndex === -1) return null;

  let intervals;
  switch (scaleType) {
    case 'natural_minor':
      intervals = NATURAL_MINOR_SCALE_INTERVALS;
      break;
    case 'harmonic_minor':
      intervals = HARMONIC_MINOR_SCALE_INTERVALS;
      break;
    case 'melodic_minor':
      intervals = MELODIC_MINOR_SCALE_INTERVALS;
      break;
    default:
      intervals = MAJOR_SCALE_INTERVALS;
  }

  const useSharps = !key.includes('b');
  return intervals.map(interval => 
    getNoteName(keyIndex + interval, useSharps)
  );
};

// 三和弦类型
const TRIAD_TYPES = {
  'major': [0, 4, 7],      // 大三和弦：大三度 + 纯五度
  'minor': [0, 3, 7],      // 小三和弦：小三度 + 纯五度
  'diminished': [0, 3, 6], // 减三和弦：小三度 + 减五度
  'augmented': [0, 4, 8]   // 增三和弦：大三度 + 增五度
};

// 七和弦类型
const SEVENTH_CHORD_TYPES = {
  'major_seventh': [0, 4, 7, 11],      // 大七和弦
  'minor_seventh': [0, 3, 7, 10],      // 小七和弦
  'dominant_seventh': [0, 4, 7, 10],   // 属七和弦
  'diminished_seventh': [0, 3, 6, 9],  // 减七和弦
  'half_diminished_seventh': [0, 3, 6, 10] // 半减七和弦
};

// 获取和弦音
const getChordNotes = (root, chordType, isSeventh = false) => {
  const rootIndex = getNoteIndex(root);
  if (rootIndex === -1) return null;

  const chordTypes = isSeventh ? SEVENTH_CHORD_TYPES : TRIAD_TYPES;
  const intervals = chordTypes[chordType];
  if (!intervals) return null;

  const useSharps = !root.includes('b');
  return intervals.map(interval => 
    getNoteName(rootIndex + interval, useSharps)
  );
};

// 转位计算
const getInversion = (notes, inversion) => {
  if (inversion === 0) return [...notes];
  const result = [...notes];
  for (let i = 0; i < inversion; i++) {
    const firstNote = result.shift();
    result.push(firstNote);
  }
  return result;
};

// 终止式类型
const CADENCE_TYPES = {
  'authentic': {
    name: '正格终止',
    description: 'V -> I 的进行，具有强烈的结束感',
    romanNumerals: ['V', 'I']
  },
  'plagal': {
    name: '变格终止',
    description: 'IV -> I 的进行，常用于赞美诗',
    romanNumerals: ['IV', 'I']
  },
  'half': {
    name: '半终止',
    description: '结束在 V 级和弦，具有不完整感',
    romanNumerals: ['?', 'V']
  },
  'deceptive': {
    name: '欺骗终止',
    description: 'V -> vi 的进行，预期 I 却到 vi',
    romanNumerals: ['V', 'vi']
  }
};

// 错因标签定义
const ERROR_TAGS = {
  'wrong_key': {
    label: '看错调性',
    description: '没有正确识别题目中的调号',
    category: 'key_signature'
  },
  'missed_accidental': {
    label: '漏看临时记号',
    description: '忽略了题目中的临时升降号',
    category: 'accidentals'
  },
  'wrong_degree': {
    label: '级数换算错',
    description: '音级或罗马数字级数计算错误',
    category: 'scale_degree'
  },
  'missing_note': {
    label: '和弦音漏音',
    description: '和弦构成时缺少必要的音',
    category: 'chord_construction'
  },
  'wrong_inversion': {
    label: '转位判断错',
    description: '没有正确识别和弦的转位形式',
    category: 'inversion'
  },
  'wrong_cadence': {
    label: '终止式类型错',
    description: '终止式类型判断错误',
    category: 'cadence'
  },
  'wrong_roman_numeral': {
    label: '罗马数字错',
    description: '和弦功能的罗马数字标记错误',
    category: 'roman_numeral'
  },
  'wrong_chord_type': {
    label: '和弦类型错',
    description: '大三/小三/减三/增三等和弦类型判断错误',
    category: 'chord_type'
  }
};

// 分析错误原因
const analyzeError = (question, userAnswer, correctAnswer) => {
  const errors = [];
  const questionType = question.type;
  const userAns = typeof userAnswer === 'string' ? JSON.parse(userAnswer) : userAnswer;
  const correctAns = typeof correctAnswer === 'string' ? JSON.parse(correctAnswer) : correctAnswer;

  switch (questionType) {
    case 'scale_identification':
      analyzeScaleIdentificationError(errors, userAns, correctAns);
      break;
    case 'chord_construction':
      analyzeChordConstructionError(errors, userAns, correctAns);
      break;
    case 'inversion':
      analyzeInversionError(errors, userAns, correctAns);
      break;
    case 'roman_numeral':
      analyzeRomanNumeralError(errors, userAns, correctAns);
      break;
    case 'cadence':
      analyzeCadenceError(errors, userAns, correctAns);
      break;
  }

  return errors;
};

const analyzeScaleIdentificationError = (errors, userAns, correctAns) => {
  if (userAns.key !== correctAns.key) {
    errors.push('wrong_key');
  }
  if (userAns.degree !== correctAns.degree) {
    errors.push('wrong_degree');
  }
};

const analyzeChordConstructionError = (errors, userAns, correctAns) => {
  const userNotes = userAns.notes || [];
  const correctNotes = correctAns.notes || [];

  if (userAns.chordType !== correctAns.chordType) {
    errors.push('wrong_chord_type');
  }

  const missingNotes = correctNotes.filter(n => !userNotes.includes(n));
  if (missingNotes.length > 0) {
    errors.push('missing_note');
  }
};

const analyzeInversionError = (errors, userAns, correctAns) => {
  if (userAns.inversion !== correctAns.inversion) {
    errors.push('wrong_inversion');
  }
  if (userAns.bassNote !== correctAns.bassNote) {
    errors.push('wrong_inversion');
  }
};

const analyzeRomanNumeralError = (errors, userAns, correctAns) => {
  if (userAns.romanNumeral !== correctAns.romanNumeral) {
    errors.push('wrong_roman_numeral');
  }
  if (userAns.function !== correctAns.function) {
    errors.push('wrong_roman_numeral');
  }
};

const analyzeCadenceError = (errors, userAns, correctAns) => {
  if (userAns.cadenceType !== correctAns.cadenceType) {
    errors.push('wrong_cadence');
  }
};

export {
  NOTE_NAMES,
  NOTE_NAMES_FLAT,
  MAJOR_KEY_SIGNATURES,
  MINOR_KEY_SIGNATURES,
  INTERVALS,
  MAJOR_SCALE_INTERVALS,
  NATURAL_MINOR_SCALE_INTERVALS,
  HARMONIC_MINOR_SCALE_INTERVALS,
  MELODIC_MINOR_SCALE_INTERVALS,
  TRIAD_TYPES,
  SEVENTH_CHORD_TYPES,
  CADENCE_TYPES,
  ERROR_TAGS,
  getNoteIndex,
  getNoteName,
  getSemitones,
  getScaleDegrees,
  getChordNotes,
  getInversion,
  analyzeError
};
