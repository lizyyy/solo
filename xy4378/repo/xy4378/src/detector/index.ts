import { Issue, Locale, LocalePackage, ScanConfig, Severity } from '../types';
import { 
  extractPlaceholders, 
  isPluralKey, 
  getPluralBaseKey, 
  getPluralForm,
  generateId,
  defaultConfig 
} from '../utils';
import { HardcodedString, UsedKey } from '../scanner/sourceScanner';

interface DetectorConfig extends Partial<ScanConfig> {}

export class Detector {
  private config: ScanConfig;
  private issues: Issue[] = [];

  constructor(config?: DetectorConfig) {
    this.config = { ...defaultConfig, ...config };
  }

  detect(
    localePackages: LocalePackage[],
    hardcodedStrings: HardcodedString[],
    usedKeys: UsedKey[]
  ): Issue[] {
    this.issues = [];

    this.detectMissingAndExtraKeys(localePackages);
    this.detectPlaceholderMismatches(localePackages);
    this.detectPluralRuleIssues(localePackages);
    this.detectHardcodedChinese(hardcodedStrings);
    this.detectUnusedKeys(localePackages, usedKeys);
    this.detectEmptyValues(localePackages);

    return this.issues;
  }

  private detectMissingAndExtraKeys(localePackages: LocalePackage[]): void {
    const allKeys = new Set<string>();
    const localeKeys: Record<Locale, Set<string>> = {
      zh: new Set(),
      en: new Set(),
      ja: new Set(),
    };

    for (const pkg of localePackages) {
      for (const key of Object.keys(pkg.data)) {
        const baseKey = getPluralBaseKey(key);
        allKeys.add(baseKey);
        localeKeys[pkg.locale].add(baseKey);
      }
    }

    for (const key of allKeys) {
      for (const pkg of localePackages) {
        if (!localeKeys[pkg.locale].has(key)) {
          this.addIssue({
            type: 'missing_key',
            severity: 'critical',
            key,
            message: `Key "${key}" 在 ${pkg.locale.toUpperCase()} 语言包中缺失`,
            locale: pkg.locale,
          });
        }
      }
    }

    for (const pkg of localePackages) {
      const referenceLocales = localePackages.filter(p => p.locale !== pkg.locale);
      const referenceKeys = new Set<string>();
      
      for (const refPkg of referenceLocales) {
        for (const key of Object.keys(refPkg.data)) {
          referenceKeys.add(getPluralBaseKey(key));
        }
      }

      for (const key of localeKeys[pkg.locale]) {
        if (!referenceKeys.has(key)) {
          this.addIssue({
            type: 'extra_key',
            severity: 'low',
            key,
            message: `Key "${key}" 只在 ${pkg.locale.toUpperCase()} 语言包中存在，其他语言包中没有`,
            locale: pkg.locale,
          });
        }
      }
    }
  }

  private detectPlaceholderMismatches(localePackages: LocalePackage[]): void {
    const keyPlaceholders: Record<string, Record<Locale, string[]>> = {};

    for (const pkg of localePackages) {
      for (const [key, value] of Object.entries(pkg.data)) {
        const baseKey = getPluralBaseKey(key);
        if (!keyPlaceholders[baseKey]) {
          keyPlaceholders[baseKey] = { zh: [], en: [], ja: [] };
        }
        const placeholders = extractPlaceholders(value);
        if (placeholders.length > 0) {
          keyPlaceholders[baseKey][pkg.locale] = placeholders;
        }
      }
    }

    for (const [key, localePlaceholders] of Object.entries(keyPlaceholders)) {
      const localesWithPlaceholders = Object.entries(localePlaceholders)
        .filter(([, ph]) => ph.length > 0) as [Locale, string[]][];

      if (localesWithPlaceholders.length < 2) continue;

      const [referenceLocale, referencePlaceholders] = localesWithPlaceholders[0];

      for (const [locale, placeholders] of localesWithPlaceholders.slice(1)) {
        const missing = referencePlaceholders.filter(p => !placeholders.includes(p));
        const extra = placeholders.filter(p => !referencePlaceholders.includes(p));

        if (missing.length > 0 || extra.length > 0) {
          this.addIssue({
            type: 'placeholder_mismatch',
            severity: 'high',
            key,
            message: `Key "${key}" 的占位符不一致`,
            locale,
            placeholderInfo: {
              expected: referencePlaceholders,
              actual: placeholders,
              locale,
            },
          });
        }
      }
    }
  }

  private detectPluralRuleIssues(localePackages: LocalePackage[]): void {
    const pluralBaseKeys = new Set<string>();

    for (const pkg of localePackages) {
      for (const key of Object.keys(pkg.data)) {
        if (isPluralKey(key)) {
          pluralBaseKeys.add(getPluralBaseKey(key));
        }
      }
    }

    for (const baseKey of pluralBaseKeys) {
      for (const pkg of localePackages) {
        const expectedForms = this.config.pluralRules[pkg.locale];
        const actualForms: string[] = [];

        for (const key of Object.keys(pkg.data)) {
          if (getPluralBaseKey(key) === baseKey) {
            const form = getPluralForm(key);
            if (form) {
              actualForms.push(form);
            }
          }
        }

        if (actualForms.length === 0) {
          const hasNonPluralForm = Object.keys(pkg.data).some(
            k => k === baseKey
          );
          
          if (hasNonPluralForm && expectedForms.length > 1) {
            this.addIssue({
              type: 'plural_rule_missing',
              severity: 'high',
              key: baseKey,
              message: `Key "${baseKey}" 在 ${pkg.locale.toUpperCase()} 中缺少复数形式`,
              locale: pkg.locale,
              pluralInfo: {
                expectedForms,
                actualForms: [],
                locale: pkg.locale,
              },
            });
          }
          continue;
        }

        const missingForms = expectedForms.filter(f => !actualForms.includes(f));
        const extraForms = actualForms.filter(f => !expectedForms.includes(f));

        if (missingForms.length > 0) {
          this.addIssue({
            type: 'plural_rule_missing',
            severity: 'high',
            key: baseKey,
            message: `Key "${baseKey}" 在 ${pkg.locale.toUpperCase()} 中缺少复数形式: ${missingForms.join(', ')}`,
            locale: pkg.locale,
            pluralInfo: {
              expectedForms,
              actualForms,
              locale: pkg.locale,
            },
          });
        }

        if (extraForms.length > 0) {
          this.addIssue({
            type: 'plural_rule_inconsistent',
            severity: 'medium',
            key: baseKey,
            message: `Key "${baseKey}" 在 ${pkg.locale.toUpperCase()} 中有多余的复数形式: ${extraForms.join(', ')}`,
            locale: pkg.locale,
            pluralInfo: {
              expectedForms,
              actualForms,
              locale: pkg.locale,
            },
          });
        }
      }
    }
  }

  private detectHardcodedChinese(hardcodedStrings: HardcodedString[]): void {
    for (const hs of hardcodedStrings) {
      this.addIssue({
        type: 'hardcoded_chinese',
        severity: 'high',
        message: `发现硬编码中文: "${hs.value}"`,
        sourceFile: hs.filePath,
        line: hs.line,
        column: hs.column,
        context: hs.context,
      });
    }
  }

  private detectUnusedKeys(
    localePackages: LocalePackage[],
    usedKeys: UsedKey[]
  ): void {
    const usedKeySet = new Set(usedKeys.map(k => k.key));
    const allKeys = new Set<string>();

    for (const pkg of localePackages) {
      for (const key of Object.keys(pkg.data)) {
        allKeys.add(getPluralBaseKey(key));
      }
    }

    for (const key of allKeys) {
      if (!usedKeySet.has(key)) {
        this.addIssue({
          type: 'unused_key',
          severity: 'low',
          key,
          message: `Key "${key}" 未在源码中使用`,
        });
      }
    }
  }

  private detectEmptyValues(localePackages: LocalePackage[]): void {
    for (const pkg of localePackages) {
      for (const [key, value] of Object.entries(pkg.data)) {
        if (typeof value === 'string' && value.trim() === '') {
          this.addIssue({
            type: 'empty_value',
            severity: 'medium',
            key,
            message: `Key "${key}" 在 ${pkg.locale.toUpperCase()} 中值为空`,
            locale: pkg.locale,
          });
        }
      }
    }
  }

  private addIssue(issue: Omit<Issue, 'id' | 'status' | 'falsePositive' | 'notes' | 'fixSuggestion' | 'createdAt' | 'updatedAt'>): void {
    const now = Date.now();
    this.issues.push({
      ...issue,
      id: generateId(),
      status: 'open',
      falsePositive: false,
      notes: '',
      fixSuggestion: this.getFixSuggestion(issue.type, issue.key, issue.locale),
      createdAt: now,
      updatedAt: now,
    });
  }

  private getFixSuggestion(type: string, key?: string, locale?: Locale): string {
    switch (type) {
      case 'missing_key':
        return `请在 ${locale?.toUpperCase()} 语言包中添加 "${key}" 对应的翻译`;
      case 'extra_key':
        return `建议确认 "${key}" 是否为多余 key，如不需要请删除，如需要请补充其他语言的翻译`;
      case 'placeholder_mismatch':
        return `请检查并统一各语言包中 "${key}" 的占位符变量名`;
      case 'plural_rule_missing':
        return `请在 ${locale?.toUpperCase()} 语言包中为 "${key}" 添加缺失的复数形式`;
      case 'plural_rule_inconsistent':
        return `请确认 "${key}" 的复数形式是否符合 ${locale?.toUpperCase()} 的语言规则`;
      case 'hardcoded_chinese':
        return `建议将硬编码中文提取到语言包中`;
      case 'unused_key':
        return `建议确认 "${key}" 是否仍在使用，如不再使用可删除`;
      case 'empty_value':
        return `请为 "${key}" 在 ${locale?.toUpperCase()} 中提供有效的翻译值`;
      default:
        return '';
    }
  }
}
