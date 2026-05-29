import * as _ from 'lodash';
import { DiffDetail, DiffType, DiffSeverity, EnvironmentName, DefaultValue, ChangeRecord } from './types';
import { masker } from './sensitiveMasker';

interface CompareOptions {
  ignoreArrayOrder?: boolean;
  detectSecrets?: boolean;
  checkDefaults?: boolean;
  knownChanges?: ChangeRecord[];
  defaults?: DefaultValue[];
}

interface CompareContext {
  baselineEnv: EnvironmentName;
  targetEnv: EnvironmentName;
  options: CompareOptions;
  path: string;
}

export class DiffEngine {
  compare(
    baseline: Record<string, unknown>,
    target: Record<string, unknown>,
    baselineEnv: EnvironmentName,
    targetEnv: EnvironmentName,
    options: CompareOptions = {}
  ): DiffDetail[] {
    const mergedOptions: CompareOptions = {
      ignoreArrayOrder: false,
      detectSecrets: true,
      checkDefaults: true,
      ...options,
    };

    const context: CompareContext = {
      baselineEnv,
      targetEnv,
      options: mergedOptions,
      path: '',
    };

    const diffs: DiffDetail[] = [];

    if (mergedOptions.detectSecrets) {
      this.detectPlaintextSecrets(target, targetEnv, diffs);
    }

    this.compareObjects(baseline, target, context, diffs);

    return diffs;
  }

  private detectPlaintextSecrets(
    obj: Record<string, unknown>,
    env: EnvironmentName,
    diffs: DiffDetail[]
  ): void {
    const result = masker.mask(obj);
    for (const secret of result.detectedSecrets) {
      diffs.push({
        key: secret.key,
        type: 'plaintext_secret',
        severity: 'critical',
        environment: env,
        baselineValue: undefined,
        targetValue: secret.value,
        explanation: `检测到明文密钥: ${secret.key} 匹配模式 "${secret.pattern}"`,
        requiresManualReview: true,
        suggestedAction: '立即替换为环境变量或密钥管理服务引用',
      });
    }
  }

  private compareObjects(
    baseline: unknown,
    target: unknown,
    context: CompareContext,
    diffs: DiffDetail[]
  ): void {
    const { path, options, baselineEnv, targetEnv } = context;

    if (baseline === undefined && target === undefined) return;

    if (baseline === null && target === null) return;

    if (typeof baseline !== typeof target && baseline !== undefined && target !== undefined) {
      diffs.push(this.createDiff(
        path,
        'type_mismatch',
        'warning',
        baseline,
        target,
        `类型不匹配: 基线(${typeof baseline}) vs 目标(${typeof target})`,
        true,
        '检查是否为配置格式错误'
      ));
      return;
    }

    if (_.isPlainObject(baseline) && _.isPlainObject(target)) {
      this.comparePlainObjects(
        baseline as Record<string, unknown>,
        target as Record<string, unknown>,
        context,
        diffs
      );
      return;
    }

    if (Array.isArray(baseline) && Array.isArray(target)) {
      this.compareArrays(baseline, target, context, diffs);
      return;
    }

    if (!_.isEqual(baseline, target)) {
      if (options.checkDefaults && context.path) {
        const defaultCheck = this.checkDefaultValue(context.path, target, options.defaults || []);
        if (defaultCheck) {
          diffs.push(defaultCheck);
          return;
        }
      }

      const knownChange = this.checkKnownChange(context.path, baseline, target, options.knownChanges || []);
      if (knownChange) {
        diffs.push(knownChange);
        return;
      }

      diffs.push(this.createDiff(
        path || '(root)',
        'value_mismatch',
        this.getValueMismatchSeverity(path, baseline, target),
        baseline,
        target,
        `值不匹配: 基线(${JSON.stringify(baseline)}) vs 目标(${JSON.stringify(target)})`,
        true
      ));
    }
  }

  private comparePlainObjects(
    baseline: Record<string, unknown>,
    target: Record<string, unknown>,
    context: CompareContext,
    diffs: DiffDetail[]
  ): void {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(target)]);

    for (const key of allKeys) {
      const newPath = context.path ? `${context.path}.${key}` : key;
      const newContext = { ...context, path: newPath };

      const baselineVal = baseline[key];
      const targetVal = target[key];

      if (!(key in baseline)) {
        diffs.push(this.createDiff(
          newPath,
          'extra_key',
          'warning',
          undefined,
          targetVal,
          `目标环境存在额外字段: ${newPath}`,
          true,
          '确认此字段是否应在基线环境中添加'
        ));
        continue;
      }

      if (!(key in target)) {
        diffs.push(this.createDiff(
          newPath,
          'missing_key',
          'warning',
          baselineVal,
          undefined,
          `目标环境缺少字段: ${newPath}`,
          true,
          '确认此字段是否在目标环境中被错误删除'
        ));
        continue;
      }

      this.compareObjects(baselineVal, targetVal, newContext, diffs);
    }
  }

  private compareArrays(
    baseline: unknown[],
    target: unknown[],
    context: CompareContext,
    diffs: DiffDetail[]
  ): void {
    const { options, path } = context;

    if (baseline.length !== target.length) {
      diffs.push(this.createDiff(
        path,
        'value_mismatch',
        'warning',
        baseline.length,
        target.length,
        `数组长度不匹配: 基线(${baseline.length}) vs 目标(${target.length})`,
        true
      ));
    }

    if (options.ignoreArrayOrder) {
      const baselineSorted = _.sortBy(baseline.map(v => JSON.stringify(v)));
      const targetSorted = _.sortBy(target.map(v => JSON.stringify(v)));

      if (!_.isEqual(baselineSorted, targetSorted)) {
        for (let i = 0; i < Math.max(baseline.length, target.length); i++) {
          const baselineVal = baseline[i];
          const targetVal = target[i];

          if (baselineVal !== undefined && targetVal !== undefined) {
            const baselineStr = JSON.stringify(baselineVal);
            const targetStr = JSON.stringify(targetVal);

            if (baselineStr !== targetStr) {
              const existsInTarget = baselineSorted.includes(baselineStr);
              const existsInBaseline = targetSorted.includes(targetStr);

              if (existsInTarget && existsInBaseline) {
                diffs.push(this.createDiff(
                  `${path}[${i}]`,
                  'array_order_mismatch',
                  'false_positive',
                  baselineVal,
                  targetVal,
                  `数组顺序不同但元素相同: ${path}[${i}]`,
                  false,
                  undefined,
                  undefined,
                  '数组顺序不影响功能，属于误报'
                ));
              } else {
                this.compareObjects(baselineVal, targetVal, { ...context, path: `${path}[${i}]` }, diffs);
              }
            }
          }
        }
      }
    } else {
      const orderDiffs: DiffDetail[] = [];
      const elementDiffs: DiffDetail[] = [];

      for (let i = 0; i < Math.max(baseline.length, target.length); i++) {
        const baselineVal = baseline[i];
        const targetVal = target[i];

        if (baselineVal === undefined) {
          diffs.push(this.createDiff(
            `${path}[${i}]`,
            'extra_key',
            'info',
            undefined,
            targetVal,
            `数组额外元素: ${path}[${i}]`,
            false
          ));
        } else if (targetVal === undefined) {
          diffs.push(this.createDiff(
            `${path}[${i}]`,
            'missing_key',
            'info',
            baselineVal,
            undefined,
            `数组缺少元素: ${path}[${i}]`,
            false
          ));
        } else if (!_.isEqual(baselineVal, targetVal)) {
          const baselineStr = JSON.stringify(baselineVal);
          const targetStr = JSON.stringify(targetVal);

          const baselineExists = target.some(t => JSON.stringify(t) === baselineStr);
          const targetExists = baseline.some(b => JSON.stringify(b) === targetStr);

          if (baselineExists && targetExists) {
            orderDiffs.push(this.createDiff(
              `${path}[${i}]`,
              'array_order_mismatch',
              'false_positive',
              baselineVal,
              targetVal,
              `数组顺序不同但元素相同: ${path}[${i}]`,
              false,
              undefined,
              undefined,
              '数组顺序不影响功能，属于误报'
            ));
          } else {
            this.compareObjects(baselineVal, targetVal, { ...context, path: `${path}[${i}]` }, elementDiffs);
          }
        }
      }

      if (elementDiffs.length === 0 && orderDiffs.length > 0) {
        diffs.push(this.createDiff(
          path,
          'array_order_mismatch',
          'false_positive',
          baseline,
          target,
          `数组整体顺序不同但元素完全相同: ${path}`,
          false,
          undefined,
          undefined,
          '数组顺序不影响功能，属于误报'
        ));
      } else {
        diffs.push(...orderDiffs, ...elementDiffs);
      }
    }
  }

  private checkDefaultValue(
    key: string,
    value: unknown,
    defaults: DefaultValue[]
  ): DiffDetail | null {
    const def = defaults.find(d => d.key === key || key.endsWith(`.${d.key}`));
    if (!def) return null;

    if (!_.isEqual(value, def.value)) {
      if (def.mutable) {
        return this.createDiff(
          key,
          'default_value_changed',
          'info',
          def.value,
          value,
          `默认值变更（允许）: ${key} 从 ${JSON.stringify(def.value)} 变为 ${JSON.stringify(value)}`,
          false,
          `该字段标记为可变更，当前值: ${JSON.stringify(value)}`
        );
      } else {
        return this.createDiff(
          key,
          'default_value_changed',
          'critical',
          def.value,
          value,
          `默认值变更（禁止）: ${key} 从 ${JSON.stringify(def.value)} 变为 ${JSON.stringify(value)}`,
          true,
          `该字段不应变更，请恢复为默认值: ${JSON.stringify(def.value)}`
        );
      }
    }

    return null;
  }

  private checkKnownChange(
    key: string,
    baseline: unknown,
    target: unknown,
    knownChanges: ChangeRecord[]
  ): DiffDetail | null {
    const change = knownChanges.find(c => {
      const keyMatch = c.key === key || key.endsWith(`.${c.key}`);
      const valueMatch = _.isEqual(c.oldValue, baseline) && _.isEqual(c.newValue, target);
      return keyMatch && valueMatch;
    });

    if (change) {
      return this.createDiff(
        key,
        'value_mismatch',
        'info',
        baseline,
        target,
        `已知变更: ${change.reason || '已记录的配置变更'}`,
        false,
        undefined,
        change.id
      );
    }

    return null;
  }

  private getValueMismatchSeverity(key: string, baseline: unknown, target: unknown): DiffSeverity {
    if (key.includes('password') || key.includes('secret') || key.includes('token')) {
      return 'critical';
    }
    if (typeof baseline === 'boolean' || typeof target === 'boolean') {
      return 'critical';
    }
    if (typeof baseline === 'number' && typeof target === 'number') {
      const ratio = Math.abs(baseline - target) / Math.max(Math.abs(baseline), 1);
      if (ratio > 0.5) return 'warning';
    }
    if (baseline === null || target === null) {
      return 'warning';
    }
    return 'warning';
  }

  private createDiff(
    key: string,
    type: DiffType,
    severity: DiffSeverity,
    baselineValue: unknown,
    targetValue: unknown,
    explanation: string,
    requiresManualReview: boolean,
    suggestedAction?: string,
    relatedChangeId?: string,
    falsePositiveReason?: string
  ): DiffDetail {
    return {
      key,
      type,
      severity,
      environment: '',
      baselineValue,
      targetValue,
      explanation,
      requiresManualReview,
      suggestedAction,
      relatedChangeId,
      falsePositiveReason,
    };
  }
}

export const diffEngine = new DiffEngine();
