import * as crypto from 'crypto';
import { RequestRecord, FieldIssue, GuardrailConfig, CorrectionNote } from './types';
import * as fs from 'fs-extra';
import * as path from 'path';

const DEFAULT_CONFIG: GuardrailConfig = {
  maxFieldLength: 500,
  maxRequestSize: 1024 * 1024,
  enableTruncation: false,
  autoDetectEncoding: true,
  strictMode: true
};

export class RequestSizeGuardrail {
  private config: GuardrailConfig;
  private records: Map<string, RequestRecord> = new Map();
  private dataDir: string;

  constructor(config?: Partial<GuardrailConfig>, dataDir: string = './src/data') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataDir = path.resolve(dataDir);
    fs.ensureDirSync(this.dataDir);
    this.loadRecords();
  }

  private generateHash(input: Record<string, any>): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
  }

  private generateId(): string {
    return `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  checkObject(obj: Record<string, any>, prefix: string = ''): FieldIssue[] {
    const issues: FieldIssue[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              issues.push(...this.checkObject(item, `${fieldPath}[${index}]`));
            } else if (typeof item === 'string') {
              issues.push(...this.checkStringField(`${fieldPath}[${index}]`, item));
            }
          });
        } else {
          issues.push(...this.checkObject(value, fieldPath));
        }
      } else if (typeof value === 'string') {
        issues.push(...this.checkStringField(fieldPath, value));
      }
    }

    return issues.filter(i => i !== null);
  }

  private checkStringField(fieldPath: string, value: string): FieldIssue[] {
    const issues: FieldIssue[] = [];
    const byteLength = Buffer.byteLength(value, 'utf8');

    if (byteLength > this.config.maxFieldLength) {
      const issue: FieldIssue = {
        fieldPath,
        originalValue: value,
        maxLength: this.config.maxFieldLength,
        actualLength: byteLength,
        issueType: this.config.enableTruncation ? 'truncated' : 'overflow',
        severity: byteLength > this.config.maxFieldLength * 2 ? 'critical' :
                  byteLength > this.config.maxFieldLength * 1.5 ? 'high' :
                  byteLength > this.config.maxFieldLength * 1.2 ? 'medium' : 'low'
      };

      if (this.config.enableTruncation) {
        issue.truncatedValue = value.slice(0, Math.floor(this.config.maxFieldLength / 3));
      }

      issues.push(issue);
    }

    return issues;
  }

  processRequest(
    source: string,
    requestType: string,
    input: Record<string, any>,
    metadata: Record<string, any> = {}
  ): { record: RequestRecord; isDuplicate: boolean; existingRecord?: RequestRecord } {
    const requestHash = this.generateHash(input);

    const existing = Array.from(this.records.values()).find(r => r.requestHash === requestHash);
    if (existing) {
      return {
        record: existing,
        isDuplicate: true,
        existingRecord: existing
      };
    }

    const fieldIssues = this.checkObject(input);

    const record: RequestRecord = {
      id: this.generateId(),
      requestHash,
      timestamp: new Date().toISOString(),
      source,
      requestType,
      originalInput: JSON.parse(JSON.stringify(input)),
      fieldIssues,
      corrections: [],
      status: fieldIssues.length > 0 ? 'pending' : 'reviewed',
      metadata
    };

    this.records.set(record.id, record);
    this.saveRecords();

    return { record, isDuplicate: false };
  }

  addCorrection(
    recordId: string,
    fieldPath: string,
    operator: string,
    originalDecision: string,
    correctedDecision: string,
    reason: string,
    evidence?: string
  ): CorrectionNote | null {
    const record = this.records.get(recordId);
    if (!record) return null;

    const correction: CorrectionNote = {
      id: `COR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      operator,
      fieldPath,
      originalDecision,
      correctedDecision,
      reason,
      evidence
    };

    record.corrections.push(correction);
    record.status = 'corrected';
    this.saveRecords();

    return correction;
  }

  getFieldOriginalValue(recordId: string, fieldPath: string): any {
    const record = this.records.get(recordId);
    if (!record) return null;

    const parts = fieldPath.split(/\./);
    let current: any = record.originalInput;

    for (const part of parts) {
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrName, index] = arrayMatch;
        current = current[arrName]?.[parseInt(index)];
      } else {
        current = current[part];
      }
      if (current === undefined) return null;
    }

    return current;
  }

  findRecordsByFieldIssue(fieldPath: string): RequestRecord[] {
    return Array.from(this.records.values()).filter(r =>
      r.fieldIssues.some(i => i.fieldPath === fieldPath)
    );
  }

  getPendingRecords(): RequestRecord[] {
    return Array.from(this.records.values()).filter(r => r.status === 'pending');
  }

  getRecordById(id: string): RequestRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): RequestRecord[] {
    return Array.from(this.records.values());
  }

  private saveRecords(): void {
    const data = {
      records: Array.from(this.records.values()),
      savedAt: new Date().toISOString()
    };
    fs.writeJSONSync(path.join(this.dataDir, 'records.json'), data, { spaces: 2 });
  }

  private loadRecords(): void {
    const filePath = path.join(this.dataDir, 'records.json');
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readJSONSync(filePath);
        data.records.forEach((r: RequestRecord) => {
          this.records.set(r.id, r);
        });
      } catch (e) {
        console.warn('Failed to load records, starting fresh');
      }
    }
  }

  getConfig(): GuardrailConfig {
    return { ...this.config };
  }
}
