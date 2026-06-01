import type {
  Level,
  ImportedData,
  DataConflict,
  ValidationResult,
  EmptyValueReport,
  DuplicateReport,
  BoundaryReport,
  JsonValue,
} from '@/types';

export class DataValidator {
  static validateLevel(level: Level): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!level.id) {
      errors.push('关卡ID不能为空');
    }
    if (!level.title) {
      errors.push('关卡标题不能为空');
    }
    if (level.totalRounds <= 0) {
      errors.push('回合数必须大于0');
    }
    if (level.rounds.length !== level.totalRounds) {
      errors.push(`回合配置不匹配：配置了${level.rounds.length}个回合，但声明了${level.totalRounds}个回合`);
    }

    level.rounds.forEach((round, index) => {
      if (!round.choices || round.choices.length === 0) {
        errors.push(`第${index + 1}回合没有配置选项`);
      }
      if (!round.correctChoiceId) {
        errors.push(`第${index + 1}回合没有配置正确答案`);
      }
      if (round.choices && !round.choices.find(c => c.id === round.correctChoiceId)) {
        errors.push(`第${index + 1}回合的正确答案ID不存在于选项中`);
      }
      if (round.choices) {
        const hasCorrect = round.choices.some(c => c.isCorrect);
        if (!hasCorrect) {
          errors.push(`第${index + 1}回合没有正确选项`);
        }
      }
    });

    const emptyValues = this.checkEmptyValues(level);
    if (emptyValues.length > 0) {
      warnings.push(`检测到${emptyValues.length}个空值字段`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static detectConflicts(level: Level, importedData: ImportedData): DataConflict[] {
    const conflicts: DataConflict[] = [];

    const round1Data = importedData.data?.round1 as Record<string, JsonValue> | undefined;
    if (round1Data?.passengerFlow !== undefined) {
      const presetValue = level.rounds[0]?.evidence.find(e => e.id === 'ev-1-1')?.value;
      const importedValue = round1Data.passengerFlow;
      if (presetValue !== importedValue && presetValue !== null && importedValue !== null) {
        conflicts.push({
          id: 'conflict-1',
          field: '第1回合-客流量',
          presetValue,
          importedValue,
          presetEvidence: '关卡预设数据：ev-1-1，来源：课堂计分表-客流统计',
          importedEvidence: `导入数据来源：${importedData.source}，教师备注：${importedData.teacherNote || '无'}`,
          suggestion: '建议使用导入数据（修正版），因为它包含了最新的实际统计数据。但请确认数据来源的可靠性。',
          resolved: false,
        });
      }
    }

    if (round1Data?.historicalAverage !== undefined) {
      const presetValue = level.rounds[0]?.evidence.find(e => e.id === 'ev-1-2')?.value;
      const importedValue = round1Data.historicalAverage;
      if (presetValue !== importedValue && presetValue !== null && importedValue !== null) {
        conflicts.push({
          id: 'conflict-2',
          field: '第1回合-历史均值',
          presetValue,
          importedValue,
          presetEvidence: '关卡预设数据：ev-1-2，来源：课堂计分表-历史数据',
          importedEvidence: `导入数据来源：${importedData.source}`,
          suggestion: '建议使用导入数据，历史均值可能已更新。请确认哪个数据更准确。',
          resolved: false,
        });
      }
    }

    const round3Data = importedData.data?.round3 as Record<string, JsonValue> | undefined;
    if (round3Data?.threshold !== undefined) {
      const presetValue = level.rounds[2]?.evidence.find(e => e.id === 'ev-3-2')?.value;
      const importedValue = round3Data.threshold;
      if (presetValue !== importedValue && presetValue !== null && importedValue !== null) {
        conflicts.push({
          id: 'conflict-3',
          field: '第3回合-安全阈值',
          presetValue,
          importedValue,
          presetEvidence: '关卡预设数据：ev-3-2，来源：课堂计分表-安全阈值',
          importedEvidence: `导入数据来源：${importedData.source}，教师备注：第3回合阈值应为${importedValue}`,
          suggestion: '建议使用导入数据，因为教师明确指出阈值需要修正。这会影响边界情况的判断。',
          resolved: false,
        });
      }
    }

    const round2Data = importedData.data?.round2 as Record<string, JsonValue> | undefined;
    if (round2Data?.line10Interval !== undefined && round2Data.line10Interval !== null) {
      const presetValue = level.rounds[1]?.evidence.find(e => e.id === 'ev-2-3')?.value;
      const importedValue = round2Data.line10Interval;
      if (presetValue === null && importedValue !== null) {
        conflicts.push({
          id: 'conflict-4',
          field: '第2回合-10号线发车间隔',
          presetValue: 'null（空值）',
          importedValue,
          presetEvidence: '关卡预设数据：ev-2-2，该字段为空，用于测试空值处理能力',
          importedEvidence: `导入数据提供了实际值：${importedValue}`,
          suggestion: '这是空值补充场景，不是冲突。建议使用导入数据，这样可以测试完整数据下的决策能力。',
          resolved: false,
        });
      }
    }

    return conflicts;
  }

  static checkEmptyValues(data: unknown, path: string = ''): EmptyValueReport[] {
    const reports: EmptyValueReport[] = [];

    if (data === null || data === undefined || data === '') {
      reports.push({
        field: path || 'root',
        path,
        defaultValue: this.getDefaultValue(data),
      });
      return reports;
    }

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        reports.push(...this.checkEmptyValues(item, `${path}[${index}]`));
      });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        reports.push(...this.checkEmptyValues(value, newPath));
      });
    }

    return reports;
  }

  static checkDuplicates(data: JsonValue[]): DuplicateReport[] {
    const reports: DuplicateReport[] = [];
    const seen = new Map<string, { count: number; values: JsonValue[] }>();

    data.forEach(item => {
      const key = JSON.stringify(item);
      if (seen.has(key)) {
        const entry = seen.get(key)!;
        entry.count++;
        entry.values.push(item);
      } else {
        seen.set(key, { count: 1, values: [item] });
      }
    });

    seen.forEach((entry, key) => {
      if (entry.count > 1) {
        reports.push({
          field: key,
          duplicates: entry.values,
          count: entry.count,
        });
      }
    });

    return reports;
  }

  static checkBoundaryCases(level: Level): BoundaryReport[] {
    const reports: BoundaryReport[] = [];

    level.rounds.forEach((round, roundIndex) => {
      round.evidence.forEach(ev => {
        if (typeof ev.value === 'number') {
          const threshold = round.evidence.find(e => e.content.includes('阈值') || e.content.includes('容量'))?.value as number;
          if (threshold !== undefined) {
            if (ev.value === threshold) {
              reports.push({
                field: `第${roundIndex + 1}回合-${ev.content}`,
                value: ev.value,
                type: 'edge',
                message: `该值正好等于阈值${threshold}，属于边界情况`,
              });
            }
            if (ev.value === 0) {
              reports.push({
                field: `第${roundIndex + 1}回合-${ev.content}`,
                value: ev.value,
                type: 'min',
                message: '该值为0，属于最小值边界情况',
              });
            }
            if (ev.value >= threshold * 2) {
              reports.push({
                field: `第${roundIndex + 1}回合-${ev.content}`,
                value: ev.value,
                type: 'max',
                message: `该值远大于阈值${threshold}，属于最大值边界情况`,
              });
            }
          }
        }
      });
    });

    return reports;
  }

  private static getDefaultValue(value: unknown): JsonValue {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'string') {
      return '';
    }
    if (typeof value === 'number') {
      return 0;
    }
    if (typeof value === 'boolean') {
      return false;
    }
    return null;
  }

  static validateImportedData(data: ImportedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('导入数据格式错误，应为JSON对象');
      return { valid: false, errors, warnings };
    }

    if (!data.source) {
      warnings.push('导入数据缺少来源信息');
    }

    if (!data.data || typeof data.data !== 'object') {
      errors.push('导入数据缺少data字段，或data不是对象');
    } else {
      const dataObj = data.data as Record<string, unknown>;
      if (!dataObj.round1 && !dataObj.round2 && !dataObj.round3) {
        warnings.push('导入数据没有包含任何回合数据');
      }
    }

    const emptyValues = this.checkEmptyValues(data);
    if (emptyValues.length > 0) {
      warnings.push(`检测到${emptyValues.length}个空值字段，将使用默认值填充`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static parseImportData(text: string): { data: ImportedData | null; error?: string } {
    try {
      const parsed = JSON.parse(text);
      const validation = this.validateImportedData(parsed);
      if (!validation.valid) {
        return { data: null, error: validation.errors.join('；') };
      }
      return {
        data: {
          source: parsed.source || '未知来源',
          data: parsed.data || {},
          importedAt: Date.now(),
          teacherNote: parsed.teacherNote,
        },
      };
    } catch {
      return { data: null, error: 'JSON格式错误，请检查导入文件' };
    }
  }
}
