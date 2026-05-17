import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Alert, Rule, Silence, ParseError } from './types';

export class DataParser {
  private errors: ParseError[] = [];

  getParseErrors(): ParseError[] {
    return this.errors;
  }

  clearErrors(): void {
    this.errors = [];
  }

  private addError(file: string, error: string, lineNumber?: number, rawContent?: string): void {
    this.errors.push({
      file,
      lineNumber,
      rawContent,
      error,
      timestamp: Date.now(),
    });
  }

  parseAlerts(filePath: string): Alert[] {
    const content = this.readFile(filePath);
    if (!content) return [];

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return this.parseAlertsJson(content, filePath);
    } else if (ext === '.csv') {
      return this.parseAlertsCsv(content, filePath);
    } else {
      this.addError(filePath, `不支持的文件格式: ${ext}`);
      return [];
    }
  }

  parseRules(filePath: string): Rule[] {
    const content = this.readFile(filePath);
    if (!content) return [];

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return this.parseRulesJson(content, filePath);
    } else if (ext === '.csv') {
      return this.parseRulesCsv(content, filePath);
    } else {
      this.addError(filePath, `不支持的文件格式: ${ext}`);
      return [];
    }
  }

  parseSilences(filePath: string): Silence[] {
    const content = this.readFile(filePath);
    if (!content) return [];

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return this.parseSilencesJson(content, filePath);
    } else if (ext === '.csv') {
      return this.parseSilencesCsv(content, filePath);
    } else {
      this.addError(filePath, `不支持的文件格式: ${ext}`);
      return [];
    }
  }

  private readFile(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        this.addError(filePath, '文件不存在');
        return null;
      }
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      this.addError(filePath, `读取文件失败: ${(e as Error).message}`);
      return null;
    }
  }

  private parseAlertsJson(content: string, filePath: string): Alert[] {
    try {
      const data = JSON.parse(content);
      const alerts: Alert[] = [];
      const rawAlerts = Array.isArray(data) ? data : data.data || data.alerts || [];

      rawAlerts.forEach((item: any, index: number) => {
        try {
          alerts.push(this.validateAlert(item, index + 1));
        } catch (e) {
          this.addError(filePath, (e as Error).message, index + 1, JSON.stringify(item));
        }
      });

      return alerts;
    } catch (e) {
      this.addError(filePath, `JSON解析失败: ${(e as Error).message}`);
      return [];
    }
  }

  private parseAlertsCsv(content: string, filePath: string): Alert[] {
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      const alerts: Alert[] = [];

      records.forEach((record: any, index: number) => {
        try {
          const alert: Alert = {
            id: record.id || `alert-${index}`,
            ruleName: record.ruleName || record.rule_name || '',
            ruleId: record.ruleId || record.rule_id || '',
            severity: (record.severity || 'info') as any,
            timestamp: this.parseTimestamp(record.timestamp || record.time),
            labels: this.parseJsonField(record.labels, {}),
            annotations: this.parseJsonField(record.annotations, {}),
            fingerprint: record.fingerprint,
          };
          alerts.push(this.validateAlert(alert, index + 1));
        } catch (e) {
          this.addError(filePath, (e as Error).message, index + 2, JSON.stringify(record));
        }
      });

      return alerts;
    } catch (e) {
      this.addError(filePath, `CSV解析失败: ${(e as Error).message}`);
      return [];
    }
  }

  private parseRulesJson(content: string, filePath: string): Rule[] {
    try {
      const data = JSON.parse(content);
      const rules: Rule[] = [];
      const rawRules = Array.isArray(data) ? data : data.data || data.rules || [];

      rawRules.forEach((item: any, index: number) => {
        try {
          rules.push(this.validateRule(item, index + 1));
        } catch (e) {
          this.addError(filePath, (e as Error).message, index + 1, JSON.stringify(item));
        }
      });

      return rules;
    } catch (e) {
      this.addError(filePath, `JSON解析失败: ${(e as Error).message}`);
      return [];
    }
  }

  private parseRulesCsv(content: string, filePath: string): Rule[] {
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      const rules: Rule[] = [];

      records.forEach((record: any, index: number) => {
        try {
          const rule: Rule = {
            id: record.id || `rule-${index}`,
            name: record.name || '',
            expr: record.expr || record.expression || '',
            severity: record.severity || 'info',
            labels: this.parseJsonField(record.labels, {}),
            annotations: this.parseJsonField(record.annotations, {}),
          };
          rules.push(this.validateRule(rule, index + 1));
        } catch (e) {
          this.addError(filePath, (e as Error).message, index + 2, JSON.stringify(record));
        }
      });

      return rules;
    } catch (e) {
      this.addError(filePath, `CSV解析失败: ${(e as Error).message}`);
      return [];
    }
  }

  private parseSilencesJson(content: string, filePath: string): Silence[] {
    try {
      const data = JSON.parse(content);
      const silences: Silence[] = [];
      const rawSilences = Array.isArray(data) ? data : data.data || data.silences || [];

      rawSilences.forEach((item: any, index: number) => {
        try {
          silences.push(this.validateSilence(item, index + 1));
        } catch (e) {
          this.addError(filePath, (e as Error).message, index + 1, JSON.stringify(item));
        }
      });

      return silences;
    } catch (e) {
      this.addError(filePath, `JSON解析失败: ${(e as Error).message}`);
      return [];
    }
  }

  private parseSilencesCsv(content: string, filePath: string): Silence[] {
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      const silences: Silence[] = [];

      records.forEach((record: any, index: number) => {
        try {
          const silence: Silence = {
            id: record.id || `silence-${index}`,
            comment: record.comment || '',
            createdBy: record.createdBy || record.created_by || '',
            startsAt: this.parseTimestamp(record.startsAt || record.starts_at),
            endsAt: this.parseTimestamp(record.endsAt || record.ends_at),
            matchers: this.parseJsonField(record.matchers, []),
            status: (record.status || 'active') as any,
          };
          silences.push(this.validateSilence(silence, index + 1));
        } catch (e) {
          this.addError(filePath, (e as Error).message, index + 2, JSON.stringify(record));
        }
      });

      return silences;
    } catch (e) {
      this.addError(filePath, `CSV解析失败: ${(e as Error).message}`);
      return [];
    }
  }

  private validateAlert(item: any, lineNumber: number): Alert {
    if (!item.ruleId && !item.ruleName) {
      throw new Error(`告警缺少 ruleId 或 ruleName`);
    }

    return {
      id: item.id || `alert-${lineNumber}`,
      ruleName: item.ruleName || '',
      ruleId: item.ruleId || '',
      severity: item.severity || 'info',
      timestamp: item.timestamp || Date.now(),
      labels: item.labels || {},
      annotations: item.annotations || {},
      fingerprint: item.fingerprint,
    };
  }

  private validateRule(item: any, lineNumber: number): Rule {
    if (!item.name) {
      throw new Error(`规则缺少 name`);
    }

    return {
      id: item.id || `rule-${lineNumber}`,
      name: item.name,
      expr: item.expr || '',
      severity: item.severity || 'info',
      labels: item.labels || {},
      annotations: item.annotations || {},
    };
  }

  private validateSilence(item: any, lineNumber: number): Silence {
    if (!item.matchers || !Array.isArray(item.matchers)) {
      throw new Error(`静默配置缺少 matchers 数组`);
    }

    return {
      id: item.id || `silence-${lineNumber}`,
      comment: item.comment || '',
      createdBy: item.createdBy || '',
      startsAt: item.startsAt || Date.now(),
      endsAt: item.endsAt || Date.now() + 86400000,
      matchers: item.matchers,
      status: item.status || 'active',
    };
  }

  private parseTimestamp(value: any): number {
    if (!value) return Date.now();
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return isNaN(parsed) ? Date.now() : parsed;
  }

  private parseJsonField(value: any, defaultValue: any): any {
    if (!value) return defaultValue;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
}