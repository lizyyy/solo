import { isValidKey, suggestSimilarKey, getSemitoneDifference, transposeNote, isTuningCompatible, getTuningSuggestion } from '../utils/musicTheory';
import type { Song, Key, ValidationResult, KeyFormatCheck, VocalRangeCheck, InstrumentTuningCheck, DurationCheck } from '../../shared/types';

export const KeyValidationService = {
  validateKeyFormat: (key: string): KeyFormatCheck => {
    if (isValidKey(key)) {
      return {
        passed: true,
        message: `调号 ${key} 格式正确`,
      };
    }

    const suggestion = suggestSimilarKey(key);
    return {
      passed: false,
      message: `调号 '${key}' 不存在，有效的调号包括：C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B`,
      suggestion: suggestion !== key ? `您是否想说 '${suggestion}'？` : undefined,
    };
  },

  validateVocalRange: (song: Song): VocalRangeCheck => {
    if (!song.vocalRange || !song.vocalRange.min || !song.vocalRange.max) {
      return {
        passed: true,
        message: '未设置主唱音域，跳过检查',
      };
    }

    if (!isValidKey(song.originalKey) || !isValidKey(song.currentKey)) {
      return {
        passed: false,
        message: '原调或当前调号无效，无法检查主唱音域',
      };
    }

    const semitoneDiff = getSemitoneDifference(song.originalKey, song.currentKey);
    const transposedMax = transposeNote(song.vocalRange.max, semitoneDiff);

    const vocalistMaxMidi = getNoteMidiValue(song.vocalRange.max);
    const transposedMaxMidi = getNoteMidiValue(transposedMax);

    const diff = transposedMaxMidi - vocalistMaxMidi;

    if (diff <= 0) {
      return {
        passed: true,
        message: `转调后最高音 ${transposedMax} 在主唱音域范围内（原调 ${song.originalKey} → 当前调 ${song.currentKey}，变化 ${semitoneDiff > 0 ? '+' : ''}${semitoneDiff} 个半音）`,
      };
    }

    return {
      passed: false,
      message: `转调后最高音 ${transposedMax} 超出主唱音域 ${diff} 个半音，主唱最高音为 ${song.vocalRange.max}`,
      details: {
        originalNote: song.vocalRange.max,
        transposedNote: transposedMax,
        vocalistMax: song.vocalRange.max,
        semitoneDiff: diff,
      },
    };
  },

  validateInstrumentTuning: (song: Song): InstrumentTuningCheck => {
    const tuning = song.instrumentTunings?.guitar;
    if (!tuning) {
      return {
        passed: true,
        message: '未设置吉他调弦，跳过检查',
      };
    }

    if (!isValidKey(song.currentKey)) {
      return {
        passed: false,
        message: '当前调号无效，无法检查乐器调弦兼容性',
      };
    }

    if (isTuningCompatible(tuning, song.currentKey)) {
      return {
        passed: true,
        message: `${tuning} 调弦与 ${song.currentKey} 调兼容`,
      };
    }

    return {
      passed: false,
      message: `${tuning} 调弦与 ${song.currentKey} 调不兼容，可能需要变调夹或重新调弦`,
      suggestion: getTuningSuggestion(tuning, song.currentKey),
    };
  },

  validateDuration: (duration: number, maxDuration: number, totalDuration: number): DurationCheck => {
    const projectedTotal = totalDuration + duration;

    if (projectedTotal <= maxDuration) {
      return {
        passed: true,
        message: `时长 ${formatDuration(duration)} 在限制范围内，累计总时长 ${formatDuration(projectedTotal)} / ${formatDuration(maxDuration)}`,
      };
    }

    const over = projectedTotal - maxDuration;
    return {
      passed: false,
      message: `加入后总时长 ${formatDuration(projectedTotal)} 超出限制 ${formatDuration(over)}，最大允许 ${formatDuration(maxDuration)}`,
    };
  },

  validateSong: (song: Song, maxDuration: number, currentTotalDuration: number): ValidationResult => {
    const keyCheck = KeyValidationService.validateKeyFormat(song.currentKey);
    const originalKeyCheck = KeyValidationService.validateKeyFormat(song.originalKey);
    const vocalRangeCheck = KeyValidationService.validateVocalRange(song);
    const instrumentCheck = KeyValidationService.validateInstrumentTuning(song);
    const durationCheck = KeyValidationService.validateDuration(song.duration, maxDuration, currentTotalDuration);

    const mergedKeyCheck: KeyFormatCheck = {
      passed: keyCheck.passed && originalKeyCheck.passed,
      message: !keyCheck.passed ? keyCheck.message : (!originalKeyCheck.passed ? `原调：${originalKeyCheck.message}` : keyCheck.message),
      suggestion: keyCheck.suggestion || originalKeyCheck.suggestion,
    };

    const allChecks = [mergedKeyCheck, vocalRangeCheck, instrumentCheck, durationCheck];
    const passed = allChecks.every(c => c.passed);
    const errors = allChecks.filter(c => !c.passed);
    const severity: 'error' | 'warning' = errors.length > 0 ? 'error' : 'warning';
    const message = errors.length > 0 ? errors[0].message : '所有检查通过';
    const suggestion = errors.length > 0 ? (errors[0] as KeyFormatCheck).suggestion : undefined;

    return {
      songId: song.id,
      songName: song.name,
      passed,
      severity,
      checkType: 'all',
      message,
      suggestion,
      details: {
        keyFailed: !mergedKeyCheck.passed,
        vocalRangeFailed: !vocalRangeCheck.passed,
        instrumentFailed: !instrumentCheck.passed,
        durationFailed: !durationCheck.passed,
      },
      checks: {
        keyFormat: mergedKeyCheck,
        vocalRange: vocalRangeCheck,
        instrumentTuning: instrumentCheck,
        duration: durationCheck,
      },
    };
  },
};

const getNoteMidiValue = (note: string): number => {
  const noteToMidi: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11,
  };

  const match = note.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return 60;

  const [, notePart, octaveStr] = match;
  const octave = parseInt(octaveStr);
  const semitone = noteToMidi[notePart] ?? 0;

  return (octave + 1) * 12 + semitone;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default KeyValidationService;
