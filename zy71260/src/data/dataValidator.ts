import type { Mode, Chord, ModulationPath, AudioSample, ValidationResult } from '../types';
import { checkEnharmonicConfusion, checkModulationDistance, isValidModulation, noteToMidi, getModeScale, getChordNotes, midiToNote } from '../utils/musicTheory';

export const validateMode = (mode: Mode, allModes: Mode[]): ValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const checks = {
    enharmonicConfusion: false,
    audioMismatch: false,
    brokenPath: false,
    invalidInterval: false,
  };

  const enharmonicDuplicates = allModes.filter(
    (m) => m.id !== mode.id && noteToMidi(m.rootNote) === noteToMidi(mode.rootNote) && m.type === mode.type
  );

  if (enharmonicDuplicates.length > 0) {
    checks.enharmonicConfusion = true;
    warnings.push(`存在等音混淆: 与 ${enharmonicDuplicates.map((m) => m.name).join(', ')} 音高相同但名称不同`);
  }

  if (mode.fifthsPosition < -6 || mode.fifthsPosition > 5) {
    checks.invalidInterval = true;
    errors.push('五度圈位置超出有效范围 (-6 到 5)');
  }

  if (mode.brightness < -3 || mode.brightness > 3) {
    checks.invalidInterval = true;
    errors.push('调式亮度值超出有效范围 (-3 到 3)');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    checks,
    warnings,
    errors,
  };
};

export const validateChord = (chord: Chord, allModes: Mode[]): ValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const checks = {
    enharmonicConfusion: false,
    audioMismatch: false,
    brokenPath: false,
    invalidInterval: false,
  };

  const parentMode = allModes.find((m) => m.id === chord.modeId);
  if (!parentMode) {
    checks.brokenPath = true;
    errors.push('和弦所属调式不存在');
  }

  const validFunctions = ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading'];
  if (!validFunctions.includes(chord.function)) {
    checks.invalidInterval = true;
    errors.push(`无效的和弦功能: ${chord.function}`);
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    checks,
    warnings,
    errors,
  };
};

export const validateModulationPath = (
  path: ModulationPath,
  modes: Mode[]
): ValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const checks = {
    enharmonicConfusion: false,
    audioMismatch: false,
    brokenPath: false,
    invalidInterval: false,
  };

  const fromMode = modes.find((m) => m.id === path.fromModeId);
  const toMode = modes.find((m) => m.id === path.toModeId);

  if (!fromMode || !toMode) {
    checks.brokenPath = true;
    path.isBroken = true;
    errors.push('转调路径断裂: 起始或目标调式不存在');
  } else {
    const distance = checkModulationDistance(fromMode.rootNote, toMode.rootNote);
    
    if (distance > 5) {
      checks.brokenPath = true;
      path.isBroken = true;
      warnings.push(`转调距离较远 (${distance} 个五度), 可能造成听觉断裂`);
    }

    const validation = isValidModulation(fromMode.rootNote, toMode.rootNote, path.type);
    if (!validation.valid && validation.reason) {
      checks.invalidInterval = true;
      warnings.push(validation.reason);
    }

    if (path.type === 'enharmonic') {
      const isEnharmonic = checkEnharmonicConfusion(fromMode.rootNote, toMode.rootNote);
      if (!isEnharmonic && distance !== 6) {
        checks.enharmonicConfusion = true;
        warnings.push('等音转调的两个调式不是真正的等音关系');
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    checks,
    warnings,
    errors,
  };
};

export const validateAudioSample = (
  sample: AudioSample,
  target: Mode | Chord | null
): ValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const checks = {
    enharmonicConfusion: false,
    audioMismatch: false,
    brokenPath: false,
    invalidInterval: false,
  };

  if (!target) {
    checks.audioMismatch = true;
    sample.isMismatched = true;
    errors.push('音频示例没有对应的目标对象');
  } else if (sample.notes.length === 0) {
    checks.audioMismatch = true;
    sample.isMismatched = true;
    errors.push('音频示例没有音符数据');
  } else if (sample.notes.length < 3) {
    checks.audioMismatch = true;
    sample.isMismatched = true;
    warnings.push('音频示例音符数量过少，可能不完整');
  } else {
    let expectedNotes: number[] = [];
    
    if (sample.targetType === 'mode') {
      const modeTarget = target as Mode;
      expectedNotes = getModeScale(modeTarget.rootNote, modeTarget.type);
    } else if (sample.targetType === 'chord') {
      const chordTarget = target as Chord;
      const chordType = chordTarget.function === 'leading' ? 'diminished' : 
                       chordTarget.name.includes('m') ? 'minor' : 'major';
      expectedNotes = getChordNotes(chordTarget.name.replace('m', ''), chordType);
    }

    const expectedNoteNames = expectedNotes.map((midi) => midiToNote(midi).replace(/\d/g, ''));
    const actualNoteNames = sample.notes.map((note) => note.replace(/\d/g, ''));

    const actualMidiSet = new Set(sample.notes.map((n) => noteToMidi(n)));
    const expectedMidiSet = new Set(expectedNotes);

    const missingNotes: number[] = [];
    expectedNotes.forEach((midi) => {
      if (!actualMidiSet.has(midi)) {
        missingNotes.push(midi);
      }
    });

    const extraNotes: number[] = [];
    sample.notes.forEach((note) => {
      const midi = noteToMidi(note);
      if (!expectedMidiSet.has(midi)) {
        extraNotes.push(midi);
      }
    });

    if (missingNotes.length > 0) {
      checks.audioMismatch = true;
      sample.isMismatched = true;
      const missingNoteNames = missingNotes.map((m) => midiToNote(m)).join(', ');
      warnings.push(`音频缺少预期音符: ${missingNoteNames}`);
    }

    if (extraNotes.length > 0) {
      checks.audioMismatch = true;
      sample.isMismatched = true;
      const extraNoteNames = extraNotes.map((m) => midiToNote(m)).join(', ');
      errors.push(`音频包含多余/错误音符: ${extraNoteNames}`);
    }

    if (sample.targetType === 'mode' && sample.notes.length !== expectedNotes.length) {
      checks.audioMismatch = true;
      sample.isMismatched = true;
      warnings.push(`音阶音符数量不匹配: 预期${expectedNotes.length}个，实际${sample.notes.length}个`);
    }

    if (sample.targetType === 'chord' && sample.notes.length !== expectedNotes.length) {
      checks.audioMismatch = true;
      sample.isMismatched = true;
      warnings.push(`和弦音符数量不匹配: 预期${expectedNotes.length}个，实际${sample.notes.length}个`);
    }

    let hasEnharmonicConfusion = false;
    actualNoteNames.forEach((actualNote, index) => {
      if (index < expectedNoteNames.length) {
        const expectedNote = expectedNoteNames[index];
        const actualMidi = noteToMidi(actualNote);
        const expectedMidi = noteToMidi(expectedNote);
        if (actualMidi === expectedMidi && actualNote !== expectedNote) {
          hasEnharmonicConfusion = true;
        }
      }
    });

    if (hasEnharmonicConfusion) {
      checks.enharmonicConfusion = true;
      warnings.push('音频音符存在等音记谱不一致');
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    checks,
    warnings,
    errors,
  };
};

export const determineDataQuality = (validation: ValidationResult): 'normal' | 'borderline' | 'error' => {
  if (!validation.isValid || validation.errors.length > 0) {
    return 'error';
  }
  if (validation.warnings.length > 0) {
    return 'borderline';
  }
  return 'normal';
};

const mergeValidation = (
  base: ValidationResult,
  extra: ValidationResult
): ValidationResult => ({
  isValid: base.isValid && extra.isValid,
  checks: {
    enharmonicConfusion: base.checks.enharmonicConfusion || extra.checks.enharmonicConfusion,
    audioMismatch: base.checks.audioMismatch || extra.checks.audioMismatch,
    brokenPath: base.checks.brokenPath || extra.checks.brokenPath,
    invalidInterval: base.checks.invalidInterval || extra.checks.invalidInterval,
  },
  warnings: [...base.warnings, ...extra.warnings],
  errors: [...base.errors, ...extra.errors],
});

export const validateAllData = (data: {
  modes: Mode[];
  chords: Chord[];
  modulationPaths: ModulationPath[];
  audioSamples: AudioSample[];
}) => {
  const validatedModes = data.modes.map((mode) => {
    const validation = validateMode(mode, data.modes);
    const quality = determineDataQuality(validation);
    return {
      ...mode,
      validation,
      quality,
    };
  });

  const validatedChords = data.chords.map((chord) => {
    const validation = validateChord(chord, validatedModes);
    const quality = determineDataQuality(validation);
    return {
      ...chord,
      validation,
      quality,
    };
  });

  const validatedPaths = data.modulationPaths.map((path) => {
    const validation = validateModulationPath(path, validatedModes);
    const quality = determineDataQuality(validation);
    return {
      ...path,
      quality,
    };
  });

  const validatedSamples = data.audioSamples.map((sample) => {
    const target = sample.targetType === 'mode'
      ? validatedModes.find((m) => m.id === sample.targetId)
      : validatedChords.find((c) => c.id === sample.targetId);
    const validation = validateAudioSample(sample, target || null);
    const quality = determineDataQuality(validation);
    return {
      ...sample,
      quality,
    };
  });

  const audioValidationsByTarget = new Map<string, ValidationResult>();
  for (const sample of validatedSamples) {
    if (sample.isMismatched || sample.quality !== 'normal') {
      const existing = audioValidationsByTarget.get(sample.targetId);
      const sampleValidation: ValidationResult = {
        isValid: sample.quality === 'normal',
        checks: {
          enharmonicConfusion: false,
          audioMismatch: sample.isMismatched,
          brokenPath: false,
          invalidInterval: false,
        },
        warnings: sample.isMismatched ? ['关联音频示例存在错配'] : [],
        errors: sample.quality === 'error' ? ['关联音频示例校验失败'] : [],
      };
      if (existing) {
        audioValidationsByTarget.set(sample.targetId, mergeValidation(existing, sampleValidation));
      } else {
        audioValidationsByTarget.set(sample.targetId, sampleValidation);
      }
    }
  }

  const finalModes = validatedModes.map((mode) => {
    const audioVal = audioValidationsByTarget.get(mode.id);
    if (!audioVal) return mode;
    const merged = mergeValidation(mode.validation, audioVal);
    return {
      ...mode,
      validation: merged,
      quality: determineDataQuality(merged),
    };
  });

  const finalChords = validatedChords.map((chord) => {
    const audioVal = audioValidationsByTarget.get(chord.id);
    if (!audioVal) return chord;
    const merged = mergeValidation(chord.validation, audioVal);
    return {
      ...chord,
      validation: merged,
      quality: determineDataQuality(merged),
    };
  });

  return {
    modes: finalModes,
    chords: finalChords,
    modulationPaths: validatedPaths,
    audioSamples: validatedSamples,
  };
};
