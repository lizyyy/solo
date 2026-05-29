import { SecretPlaceholder } from './types';
import { store } from './store';

export interface MaskResult {
  maskedContent: Record<string, unknown>;
  detectedSecrets: Array<{ key: string; value: string; pattern: string }>;
}

export class SensitiveMasker {
  private patterns: SecretPlaceholder[];

  constructor(customPatterns?: SecretPlaceholder[]) {
    this.patterns = customPatterns || store.getSecretPatterns();
  }

  mask(obj: Record<string, unknown>): MaskResult {
    const detectedSecrets: Array<{ key: string; value: string; pattern: string }> = [];
    const maskedContent = this.maskRecursive(obj, '', detectedSecrets) as Record<string, unknown>;
    return { maskedContent, detectedSecrets };
  }

  private maskRecursive(
    value: unknown,
    currentPath: string,
    detectedSecrets: Array<{ key: string; value: string; pattern: string }>
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.maskString(value, currentPath, detectedSecrets);
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.maskRecursive(item, `${currentPath}[${index}]`, detectedSecrets)
      );
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (this.isSensitiveKey(key)) {
          if (typeof val === 'string') {
            const masked = this.maskString(val, newPath, detectedSecrets, true);
            result[key] = masked;
          } else {
            result[key] = this.maskRecursive(val, newPath, detectedSecrets);
          }
        } else {
          result[key] = this.maskRecursive(val, newPath, detectedSecrets);
        }
      }
      return result;
    }

    return value;
  }

  private isPlaceholder(value: string): boolean {
    return /^\$\{[^}]+\}$/.test(value) || /^\{\{[^}]+\}\}$/.test(value);
  }

  private maskString(
    value: string,
    keyPath: string,
    detectedSecrets: Array<{ key: string; value: string; pattern: string }>,
    isSensitiveKey: boolean = false
  ): string {
    if (this.isPlaceholder(value)) {
      return value;
    }

    if (isSensitiveKey && value.length > 0) {
      detectedSecrets.push({
        key: keyPath,
        value: value,
        pattern: 'Sensitive Field Name Pattern',
      });
      return '***REDACTED***';
    }

    for (const sp of this.patterns) {
      if (sp.pattern.test(value)) {
        detectedSecrets.push({
          key: keyPath,
          value: value,
          pattern: sp.description,
        });
        return sp.placeholder;
      }
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePattern = /password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key/i;
    return sensitivePattern.test(key);
  }

  isSecretValue(value: string): boolean {
    for (const sp of this.patterns) {
      if (sp.pattern.test(value)) {
        return true;
      }
    }
    return false;
  }

  addPattern(pattern: SecretPlaceholder): void {
    this.patterns.push(pattern);
  }

  getPatterns(): SecretPlaceholder[] {
    return [...this.patterns];
  }
}

export const masker = new SensitiveMasker();
