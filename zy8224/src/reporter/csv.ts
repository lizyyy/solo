import * as fs from 'fs';
import * as path from 'path';
import { Issue, IssueCategory } from '../types';

export interface CsvIssueRecord {
  id: string;
  category: string;
  severity: string;
  workflow: string;
  job: string;
  step: string;
  title: string;
  description: string;
  remediation: string;
  line_number: string;
}

export class CsvReporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async exportIssues(issues: Issue[]): Promise<string> {
    await this.ensureOutputDir();
    
    const records: CsvIssueRecord[] = issues.map(issue => ({
      id: issue.id,
      category: this.translateCategory(issue.category),
      severity: issue.severity.toUpperCase(),
      workflow: issue.workflow,
      job: issue.job || '',
      step: issue.step || '',
      title: issue.title,
      description: issue.description,
      remediation: issue.remediation || '',
      line_number: issue.location?.line?.toString() || ''
    }));

    const header = [
      'ID',
      'Category',
      'Severity',
      'Workflow',
      'Job',
      'Step',
      'Title',
      'Description',
      'Remediation',
      'Line_Number'
    ];

    const csvLines: string[] = [];
    csvLines.push(this.escapeCsvRow(header));

    for (const record of records) {
      csvLines.push(this.escapeCsvRow([
        record.id,
        record.category,
        record.severity,
        record.workflow,
        record.job,
        record.step,
        record.title,
        record.description,
        record.remediation,
        record.line_number
      ]));
    }

    const csvContent = csvLines.join('\n');
    const outputPath = path.join(this.outputDir, 'issues.csv');
    
    await fs.promises.writeFile(outputPath, csvContent, 'utf-8');
    return outputPath;
  }

  private translateCategory(category: IssueCategory): string {
    const translations: Record<IssueCategory, string> = {
      'secret_exposure': 'Secret 暴露风险',
      'matrix_coverage': 'Matrix 覆盖',
      'concurrency_conflict': '并发组冲突',
      'artifact_expiration': 'Artifact 过期',
      'approval_missing': '审批缺失'
    };
    return translations[category] || category;
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private escapeCsvRow(values: string[]): string {
    return values.map(v => this.escapeCsvValue(v)).join(',');
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.promises.access(this.outputDir);
    } catch {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
    }
  }
}
