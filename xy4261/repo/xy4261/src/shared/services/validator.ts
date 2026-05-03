import { 
  Fixture, 
  PatchEntry, 
  Cue, 
  Project, 
  ValidationError 
} from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateFixture(fixture: Fixture): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!fixture.name || fixture.name.trim() === '') {
    errors.push(createValidationError(
      'data_error',
      'error',
      '灯具名称不能为空',
      `灯具 ID: ${fixture.id} 没有有效的名称`,
      [fixture.id]
    ));
  }

  if (!fixture.id || fixture.id.trim() === '') {
    errors.push(createValidationError(
      'data_error',
      'error',
      '灯具 ID 不能为空',
      '灯具必须有有效的唯一 ID',
      [fixture.name || '未知灯具']
    ));
  }

  if (fixture.channelCount < 1 || fixture.channelCount > 512) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '通道数无效',
      `灯具 ${fixture.name} 的通道数 ${fixture.channelCount} 不在有效范围 (1-512)`,
      [fixture.id]
    ));
  }

  if (fixture.power < 0) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '功率值无效',
      `灯具 ${fixture.name} 的功率值 ${fixture.power} 不能为负数`,
      [fixture.id]
    ));
  }

  if (fixture.power === 0) {
    warnings.push(createValidationError(
      'data_error',
      'warning',
      '功率值为零',
      `灯具 ${fixture.name} 的功率值为零，请确认是否正确`,
      [fixture.id]
    ));
  }

  if (fixture.channels.length !== fixture.channelCount) {
    warnings.push(createValidationError(
      'data_error',
      'warning',
      '通道定义不一致',
      `灯具 ${fixture.name} 的通道定义数量 (${fixture.channels.length}) 与通道数 (${fixture.channelCount}) 不一致`,
      [fixture.id]
    ));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validatePatchEntry(
  patch: PatchEntry, 
  fixtures: Fixture[],
  maxChannels: number = 512
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const fixture = fixtures.find(f => f.id === patch.fixtureId);
  if (!fixture) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '未找到对应的灯具',
      `Patch 条目 ${patch.patchName} 引用的灯具 ID ${patch.fixtureId} 不存在`,
      [patch.id]
    ));
  }

  if (patch.universe < 1) {
    errors.push(createValidationError(
      'data_error',
      'error',
      'Universe 编号无效',
      `Patch 条目 ${patch.patchName} 的 Universe 编号 ${patch.universe} 无效`,
      [patch.id]
    ));
  }

  if (patch.startChannel < 1 || patch.startChannel > maxChannels) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '起始通道无效',
      `Patch 条目 ${patch.patchName} 的起始通道 ${patch.startChannel} 不在有效范围 (1-${maxChannels})`,
      [patch.id]
    ));
  }

  if (patch.endChannel < patch.startChannel) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '结束通道无效',
      `Patch 条目 ${patch.patchName} 的结束通道 ${patch.endChannel} 小于起始通道 ${patch.startChannel}`,
      [patch.id]
    ));
  }

  if (patch.endChannel > maxChannels) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '通道超出范围',
      `Patch 条目 ${patch.patchName} 的结束通道 ${patch.endChannel} 超出 Universe 最大通道数 ${maxChannels}`,
      [patch.id]
    ));
  }

  if (fixture && (patch.endChannel - patch.startChannel + 1) !== fixture.channelCount) {
    warnings.push(createValidationError(
      'data_error',
      'warning',
      '通道数量不匹配',
      `Patch 条目 ${patch.patchName} 分配的通道数 (${patch.endChannel - patch.startChannel + 1}) 与灯具通道数 (${fixture.channelCount}) 不匹配`,
      [patch.id, fixture.id]
    ));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateCue(cue: Cue): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!cue.number || cue.number.trim() === '') {
    errors.push(createValidationError(
      'data_error',
      'error',
      'Cue 编号不能为空',
      `Cue ID: ${cue.id} 没有有效的编号`,
      [cue.id]
    ));
  }

  if (cue.time < 0) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '时间值无效',
      `Cue ${cue.number} 的时间值 ${cue.time} 不能为负数`,
      [cue.id]
    ));
  }

  if (cue.fadeIn < 0) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '淡入时间无效',
      `Cue ${cue.number} 的淡入时间 ${cue.fadeIn} 不能为负数`,
      [cue.id]
    ));
  }

  if (cue.fadeOut < 0) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '淡出时间无效',
      `Cue ${cue.number} 的淡出时间 ${cue.fadeOut} 不能为负数`,
      [cue.id]
    ));
  }

  if (cue.delay < 0) {
    errors.push(createValidationError(
      'data_error',
      'error',
      '延迟时间无效',
      `Cue ${cue.number} 的延迟时间 ${cue.delay} 不能为负数`,
      [cue.id]
    ));
  }

  if (cue.activeFixtures.length === 0 && !cue.isBlackout) {
    warnings.push(createValidationError(
      'data_error',
      'warning',
      'Cue 没有活跃灯具',
      `Cue ${cue.number} 没有关联任何活跃灯具`,
      [cue.id]
    ));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateProject(project: Project): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  for (const fixture of project.fixtures) {
    const result = validateFixture(fixture);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  const fixtureIds = new Set(project.fixtures.map(f => f.id));
  for (const patch of project.patches) {
    const result = validatePatchEntry(
      patch, 
      project.fixtures, 
      project.settings.maxChannelsPerUniverse
    );
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  for (const cue of project.cues) {
    const result = validateCue(cue);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);

    for (const fixtureId of cue.activeFixtures) {
      if (!fixtureIds.has(fixtureId)) {
        allWarnings.push(createValidationError(
          'data_error',
          'warning',
          'Cue 引用了不存在的灯具',
          `Cue ${cue.number} 引用了不存在的灯具 ID: ${fixtureId}`,
          [cue.id, fixtureId]
        ));
      }
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

function createValidationError(
  type: ValidationError['type'],
  severity: ValidationError['severity'],
  message: string,
  details: string,
  affectedItems: string[]
): ValidationError {
  return {
    id: uuidv4(),
    type,
    severity,
    message,
    details,
    affectedItems,
    timestamp: Date.now()
  };
}
