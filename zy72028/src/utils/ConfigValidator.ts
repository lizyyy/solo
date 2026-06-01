import type { MaterialPackage, ValidationResult, ValidationError, Resources } from '../types';

export class ConfigValidator {
  private static readonly RESOURCE_BOUNDS = {
    buses: { min: 0, max: 20 },
    drivers: { min: 0, max: 30 },
    budget: { min: 0, max: 10000 },
    reputation: { min: 0, max: 100 }
  };

  static validate(material: MaterialPackage): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings = [];

    const emptyEventsError = this.checkEmptyEvents(material.events);
    if (emptyEventsError) errors.push(emptyEventsError);

    const duplicateEventsError = this.checkDuplicateEvents(material.events);
    if (duplicateEventsError) errors.push(duplicateEventsError);

    const resourceErrors = this.checkResourceBoundaries(material.initialResources);
    errors.push(...resourceErrors);

    const optionErrors = this.checkCorrectOptions(material.events);
    errors.push(...optionErrors);

    const durationWarning = this.checkGameDuration(material.gameDuration);
    if (durationWarning) warnings.push(durationWarning);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static checkEmptyEvents(events: unknown[]): ValidationError | null {
    if (!events || events.length === 0) {
      return {
        type: 'empty_level',
        message: '关卡事件列表为空',
        location: 'events',
        suggestion: '请至少添加1个调度事件，建议3-5个事件以保证游戏体验'
      };
    }
    return null;
  }

  private static checkDuplicateEvents(events: { id: string }[]): ValidationError | null {
    const idSet = new Set<string>();
    const duplicates: string[] = [];

    events.forEach((event, index) => {
      if (idSet.has(event.id)) {
        duplicates.push(`事件${index + 1} (ID: ${event.id})`);
      }
      idSet.add(event.id);
    });

    if (duplicates.length > 0) {
      return {
        type: 'duplicate_event',
        message: `发现重复的事件ID: ${duplicates.join(', ')}`,
        location: 'events[].id',
        suggestion: '请确保每个事件的ID唯一，可以使用事件标题拼音或数字编号作为ID'
      };
    }
    return null;
  }

  private static checkResourceBoundaries(resources: Record<string, number> | Resources): ValidationError[] {
    const errors: ValidationError[] = [];

    Object.entries(this.RESOURCE_BOUNDS).forEach(([key, bounds]) => {
      const value = resources[key];
      if (value !== undefined && (value < bounds.min || value > bounds.max)) {
        errors.push({
          type: 'resource_out_of_bounds',
          message: `${this.getResourceName(key)}值 ${value} 超出合理范围 [${bounds.min}, ${bounds.max}]`,
          location: `initialResources.${key}`,
          suggestion: `建议将${this.getResourceName(key)}设置在 ${bounds.min} 到 ${bounds.max} 之间`
        });
      }
    });

    return errors;
  }

  private static checkCorrectOptions(events: {
    id: string;
    title: string;
    options: { isCorrect: boolean }[];
  }[]): ValidationError[] {
    const errors: ValidationError[] = [];

    events.forEach((event, index) => {
      const hasCorrectOption = event.options.some(opt => opt.isCorrect);
      if (!hasCorrectOption) {
        errors.push({
          type: 'missing_correct_option',
          message: `事件"${event.title}"(第${index + 1}个)没有设置正确选项`,
          location: `events[${index}].options`,
          suggestion: '请为每个事件至少设置一个正确的调度选项，否则玩家无法完成游戏'
        });
      }
    });

    return errors;
  }

  private static checkGameDuration(duration: number) {
    if (duration < 30) {
      return {
        type: 'duration_too_short',
        message: `游戏时长 ${duration}秒 可能过短`
      };
    }
    if (duration > 180) {
      return {
        type: 'duration_too_long',
        message: `游戏时长 ${duration}秒 超过建议的3分钟`
      };
    }
    return null;
  }

  private static getResourceName(key: string): string {
    const names: Record<string, string> = {
      buses: '公交车辆数',
      drivers: '司机数量',
      budget: '预算',
      reputation: '声誉值'
    };
    return names[key] || key;
  }

  static formatErrors(errors: ValidationError[]): string {
    return errors.map((err, i) =>
      `${i + 1}. ${err.message}\n   位置: ${err.location || '未知'}\n   建议: ${err.suggestion}`
    ).join('\n\n');
  }
}
