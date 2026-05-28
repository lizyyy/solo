import type { Mode, Chord, ModulationPath, AudioSample, ValidationResult } from '../types';
import { checkEnharmonicConfusion, checkModulationDistance, isValidModulation, noteToMidi } from '../utils/musicTheory';

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
      : data.chords.find((c) => c.id === sample.targetId);
    const validation = validateAudioSample(sample, target || null);
    const quality = determineDataQuality(validation);
    return {
      ...sample,
      quality,
    };
  });

  return {
    modes: validatedModes,
    chords: data.chords,
    modulationPaths: validatedPaths,
    audioSamples: validatedSamples,
  };
};
