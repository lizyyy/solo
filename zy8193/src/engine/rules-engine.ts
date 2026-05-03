import { 
  FlatMessages, 
  ParsedICUMessage, 
  RulesConfig, 
  Issue, 
  AnalysisResult,
  PlaceholderMismatch,
  PluralIssue,
  LongTextIssue,
  DeprecatedKeyUsage,
  IssueCategory,
  IssueSeverity
} from '../types';
import { IcuParser } from '../icu';
import { RouteEntry, ScreenshotEntry } from '../types';

interface EngineContext {
  locales: string[];
  flatMessages: { [locale: string]: FlatMessages };
  parsedMessages: { [locale: string]: { [key: string]: ParsedICUMessage } };
  allKeys: Set<string>;
  referenceLocale: string;
  routes: RouteEntry[];
  screenshots: ScreenshotEntry[];
  rules: RulesConfig;
  usedKeys: Set<string>;
}

export class RulesEngine {
  private context!: EngineContext;

  analyze(
    flatMessages: { [locale: string]: FlatMessages },
    rules: RulesConfig,
    routes: RouteEntry[] = [],
    screenshots: ScreenshotEntry[] = [],
    referenceLocale: string = 'en'
  ): AnalysisResult {
    const locales = Object.keys(flatMessages);
    
    const parsedMessages: { [locale: string]: { [key: string]: ParsedICUMessage } } = {};
    for (const locale of locales) {
      parsedMessages[locale] = {};
      for (const [key, value] of Object.entries(flatMessages[locale])) {
        parsedMessages[locale][key] = IcuParser.parse(key, value);
      }
    }

    const allKeys = new Set<string>();
    for (const locale of locales) {
      for (const key of Object.keys(flatMessages[locale])) {
        allKeys.add(key);
      }
    }

    const usedKeys = this.collectUsedKeys(routes, screenshots);

    this.context = {
      locales,
      flatMessages,
      parsedMessages,
      allKeys,
      referenceLocale,
      routes,
      screenshots,
      rules,
      usedKeys
    };

    const issues: Issue[] = [];

    issues.push(...this.checkMissingKeys());
    issues.push(...this.checkExtraKeys());
    issues.push(...this.checkUnusedKeys());
    issues.push(...this.checkInvalidIcu());
    issues.push(...this.checkPlaceholderMismatches());
    issues.push(...this.checkPluralForms());
    issues.push(...this.checkLongText());
    issues.push(...this.checkDeprecatedKeys());

    return this.buildAnalysisResult(issues);
  }

  private collectUsedKeys(routes: RouteEntry[], screenshots: ScreenshotEntry[]): Set<string> {
    const used = new Set<string>();

    for (const route of routes) {
      for (const key of route.keys) {
        used.add(key);
      }
    }

    for (const screenshot of screenshots) {
      for (const key of screenshot.keys) {
        used.add(key);
      }
    }

    return used;
  }

  private checkMissingKeys(): Issue[] {
    const issues: Issue[] = [];
    const { locales, flatMessages, allKeys, referenceLocale } = this.context;

    for (const locale of locales) {
      if (locale === referenceLocale) continue;

      for (const key of allKeys) {
        if (!(key in flatMessages[locale]) && key in flatMessages[referenceLocale]) {
          issues.push(this.createIssue(
            'missing_key',
            'error',
            locale,
            key,
            `Key "${key}" is missing in ${locale} but exists in ${referenceLocale}`,
            { reference: referenceLocale }
          ));
        }
      }
    }

    return issues;
  }

  private checkExtraKeys(): Issue[] {
    const issues: Issue[] = [];
    const { locales, flatMessages, allKeys, referenceLocale } = this.context;

    for (const locale of locales) {
      if (locale === referenceLocale) continue;

      for (const key of Object.keys(flatMessages[locale])) {
        if (!(key in flatMessages[referenceLocale])) {
          issues.push(this.createIssue(
            'extra_key',
            'warning',
            locale,
            key,
            `Key "${key}" exists in ${locale} but not in ${referenceLocale}`,
            { reference: referenceLocale }
          ));
        }
      }
    }

    return issues;
  }

  private checkUnusedKeys(): Issue[] {
    const issues: Issue[] = [];
    const { allKeys, usedKeys, referenceLocale } = this.context;

    if (usedKeys.size === 0) {
      return issues;
    }

    for (const key of allKeys) {
      if (!usedKeys.has(key)) {
        issues.push(this.createIssue(
          'unused_key',
          'info',
          referenceLocale,
          key,
          `Key "${key}" appears to be unused (not referenced in routes or screenshots)`,
          {}
        ));
      }
    }

    return issues;
  }

  private checkInvalidIcu(): Issue[] {
    const issues: Issue[] = [];
    const { locales, parsedMessages } = this.context;

    for (const locale of locales) {
      for (const [key, parsed] of Object.entries(parsedMessages[locale])) {
        if (!parsed.isValid) {
          issues.push(this.createIssue(
            'invalid_icu',
            'error',
            locale,
            key,
            `Invalid ICU expression: ${parsed.parseError}`,
            { value: parsed.raw }
          ));
        }
      }
    }

    return issues;
  }

  private checkPlaceholderMismatches(): Issue[] {
    const issues: Issue[] = [];
    const { locales, parsedMessages, referenceLocale, flatMessages } = this.context;

    if (!(referenceLocale in parsedMessages)) {
      return issues;
    }

    const refMessages = parsedMessages[referenceLocale];

    for (const locale of locales) {
      if (locale === referenceLocale) continue;

      const localeMessages = parsedMessages[locale];

      for (const [key, refParsed] of Object.entries(refMessages)) {
        if (!(key in localeMessages)) continue;

        const localeParsed = localeMessages[key];
        
        const comparison = IcuParser.comparePlaceholders(
          refParsed.placeholders,
          localeParsed.placeholders
        );

        if (comparison.added.length > 0) {
          issues.push(this.createIssue(
            'placeholder_mismatch',
            'error',
            locale,
            key,
            `Unexpected placeholders: ${comparison.added.map(p => p.name).join(', ')}`,
            {
              expected: refParsed.placeholders.map(p => p.name),
              actual: localeParsed.placeholders.map(p => p.name)
            }
          ));
        }

        if (comparison.removed.length > 0) {
          issues.push(this.createIssue(
            'placeholder_mismatch',
            'error',
            locale,
            key,
            `Missing placeholders: ${comparison.removed.map(p => p.name).join(', ')}`,
            {
              expected: refParsed.placeholders.map(p => p.name),
              actual: localeParsed.placeholders.map(p => p.name)
            }
          ));
        }

        if (comparison.typeMismatch.length > 0) {
          for (const mismatch of comparison.typeMismatch) {
            issues.push(this.createIssue(
              'placeholder_mismatch',
              'warning',
              locale,
              key,
              `Placeholder "${mismatch.name}" type mismatch: ${mismatch.aType} vs ${mismatch.bType}`,
              {
                expected: [mismatch.aType],
                actual: [mismatch.bType]
              }
            ));
          }
        }
      }
    }

    return issues;
  }

  private checkPluralForms(): Issue[] {
    const issues: Issue[] = [];
    const { locales, parsedMessages, rules } = this.context;

    for (const locale of locales) {
      const requiredForms = rules.pluralRules.localeOverrides[locale] 
        || rules.pluralRules.requiredForms;

      const localeMessages = parsedMessages[locale];

      for (const [key, parsed] of Object.entries(localeMessages)) {
        if (!parsed.hasPlural) continue;

        const missingForms = requiredForms.filter(f => !parsed.pluralForms.includes(f));

        if (missingForms.length > 0) {
          issues.push(this.createIssue(
            'plural_missing',
            'error',
            locale,
            key,
            `Missing plural forms: ${missingForms.join(', ')}. Required: ${requiredForms.join(', ')}`,
            {
              expected: requiredForms,
              actual: parsed.pluralForms
            }
          ));
        }
      }
    }

    return issues;
  }

  private checkLongText(): Issue[] {
    const issues: Issue[] = [];
    const { locales, flatMessages, rules } = this.context;

    const categoryChecks = [
      { category: 'button' as const, patterns: [/\.button$/, /\.btn$/, /button\./, /action\./] },
      { category: 'navigation' as const, patterns: [/\.nav$/, /nav\./, /menu\./, /tab\./] },
      { category: 'title' as const, patterns: [/\.title$/, /title\./, /header\./, /heading\./] }
    ];

    for (const locale of locales) {
      for (const [key, value] of Object.entries(flatMessages[locale])) {
        for (const check of categoryChecks) {
          const matchesPattern = check.patterns.some(p => p.test(key));
          if (!matchesPattern) continue;

          const limit = rules.maxTextLength[check.category];
          const length = value.length;

          if (length > limit) {
            issues.push(this.createIssue(
              'text_too_long',
              'warning',
              locale,
              key,
              `Text is too long for ${check.category} (${length}/${limit} chars)`,
              {
                value: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
                limit: limit
              }
            ));
          }
        }
      }
    }

    return issues;
  }

  private checkDeprecatedKeys(): Issue[] {
    const issues: Issue[] = [];
    const { allKeys, rules, screenshots, referenceLocale } = this.context;

    if (rules.deprecatedKeys.length === 0) {
      return issues;
    }

    for (const key of rules.deprecatedKeys) {
      if (allKeys.has(key)) {
        issues.push(this.createIssue(
          'deprecated_key',
          'warning',
          referenceLocale,
          key,
          `Key "${key}" is marked as deprecated`,
          {}
        ));
      }

      for (const screenshot of screenshots) {
        if (screenshot.keys.includes(key)) {
          issues.push(this.createIssue(
            'deprecated_key',
            'error',
            referenceLocale,
            key,
            `Deprecated key "${key}" is still referenced in screenshot: ${screenshot.name}`,
            { reference: screenshot.name }
          ));
        }
      }
    }

    return issues;
  }

  private createIssue(
    category: IssueCategory,
    severity: IssueSeverity,
    locale: string,
    key: string,
    message: string,
    context: Issue['context']
  ): Issue {
    return {
      id: `${category}-${locale}-${key}-${Date.now()}`,
      category,
      severity,
      locale,
      key,
      message,
      context
    };
  }

  private buildAnalysisResult(issues: Issue[]): AnalysisResult {
    const { locales, allKeys, flatMessages, referenceLocale, parsedMessages, rules } = this.context;

    const missingKeys: { [locale: string]: string[] } = {};
    const extraKeys: { [locale: string]: string[] } = {};
    const unusedKeys: string[] = [];
    const placeholderMismatches: PlaceholderMismatch[] = [];
    const pluralIssues: PluralIssue[] = [];
    const longTextIssues: LongTextIssue[] = [];
    const deprecatedKeyUsages: DeprecatedKeyUsage[] = [];

    for (const issue of issues) {
      switch (issue.category) {
        case 'missing_key':
          if (!missingKeys[issue.locale]) missingKeys[issue.locale] = [];
          missingKeys[issue.locale].push(issue.key);
          break;
        case 'extra_key':
          if (!extraKeys[issue.locale]) extraKeys[issue.locale] = [];
          extraKeys[issue.locale].push(issue.key);
          break;
        case 'unused_key':
          unusedKeys.push(issue.key);
          break;
      }
    }

    return {
      locales,
      totalKeys: allKeys.size,
      missingKeys,
      extraKeys,
      unusedKeys,
      issues,
      placeholderMismatches,
      pluralIssues,
      longTextIssues,
      deprecatedKeyUsages
    };
  }
}
