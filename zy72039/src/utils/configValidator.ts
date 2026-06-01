import type { GameConfig, ValidationResult } from '../types';

export function validateConfig(config: Partial<GameConfig> | null | undefined): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config) {
    errors.push('配置对象为空');
    return { isValid: false, errors, warnings };
  }

  if (!config.name || config.name.trim() === '') {
    errors.push('游戏名称不能为空');
  }

  if (config.totalRounds === undefined || config.totalRounds <= 0) {
    errors.push('总回合数必须大于0');
  }

  if (config.maxLoad === undefined || config.maxLoad <= 0) {
    errors.push('最大载荷必须大于0');
  }

  if (config.targetLoad === undefined || config.targetLoad <= 0) {
    errors.push('目标载荷必须大于0');
  } else if (config.maxLoad !== undefined && config.targetLoad > config.maxLoad) {
    errors.push(`目标载荷(${config.targetLoad})不能超过最大载荷(${config.maxLoad})`);
  }

  if (config.loadPerRound === undefined || config.loadPerRound <= 0) {
    errors.push('每轮载荷增量必须大于0');
  }

  if (config.timeLimitPerRound !== undefined && config.timeLimitPerRound < 1000) {
    warnings.push(`每轮时间限制过短(${config.timeLimitPerRound}ms)，建议不少于3000ms(3秒)`);
  }

  if (config.boundaryThreshold !== undefined) {
    if (config.boundaryThreshold < 0) {
      errors.push('边界阈值不能为负数');
    } else if (config.boundaryThreshold > 50) {
      warnings.push(`边界阈值过高(${config.boundaryThreshold}%)，建议在0%-50%之间`);
    }
  }

  if (config.duplicateWindow !== undefined && config.duplicateWindow < 0) {
    errors.push('重复检测窗口不能为负数');
  }

  if (config.misoperationThreshold !== undefined && config.misoperationThreshold < 0) {
    errors.push('误操作判定阈值不能为负数');
  }

  if (config.slowOperationThreshold !== undefined && config.slowOperationThreshold < 0) {
    errors.push('慢操作判定阈值不能为负数');
  }

  if (config.timeLimitPerRound !== undefined && 
      config.slowOperationThreshold !== undefined &&
      config.slowOperationThreshold < config.timeLimitPerRound) {
    warnings.push(`慢操作阈值(${config.slowOperationThreshold}ms)小于时间限制(${config.timeLimitPerRound}ms)，可能导致误判`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function formatValidationErrors(result: ValidationResult): string {
  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push('【错误】');
    parts.push(...result.errors.map((e, i) => `${i + 1}. ${e}`));
  }
  
  if (result.warnings.length > 0) {
    parts.push('【警告】');
    parts.push(...result.warnings.map((w, i) => `${i + 1}. ${w}`));
  }
  
  return parts.join('\n');
}
