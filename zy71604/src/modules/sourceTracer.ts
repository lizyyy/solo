import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  SourceReference,
  ReconciliationIssue,
  CalculationResult,
  DataSourceType,
} from '../types/models';

export interface TracePath {
  sourceReference: SourceReference;
  description: string;
  timestamp: string;
}

export interface TraceResult {
  issueId: string;
  issueType: string;
  issueMessage: string;
  severity: string;
  tracePaths: TracePath[];
  expectedValue?: string;
  actualValue?: string;
}

export interface SourceInfo {
  type: DataSourceType;
  typeName: string;
  id: string;
  fileName?: string;
  location?: string;
  originalValue?: string;
}

const sourceTypeNames: Record<DataSourceType, string> = {
  announcement: '分红公告',
  share_file: '份额文件',
  nav_file: '净值文件',
  client_choice: '客户选择',
  settlement_record: '到账记录',
};

export class SourceTracer {
  public traceIssue(issue: ReconciliationIssue): TraceResult {
    const tracePaths: TracePath[] = issue.sourceReferences.map((ref, index) => ({
      sourceReference: ref,
      description: this.describeSource(ref, index),
      timestamp: issue.createdAt,
    }));

    return {
      issueId: issue.id,
      issueType: issue.type,
      issueMessage: issue.message,
      severity: issue.severity,
      tracePaths,
      expectedValue: issue.expectedValue,
      actualValue: issue.actualValue,
    };
  }

  private describeSource(ref: SourceReference, index: number): string {
    const parts: string[] = [];
    
    parts.push(`来源${index + 1}: ${sourceTypeNames[ref.sourceType] || ref.sourceType}`);
    
    if (ref.sourceFileName) {
      parts.push(`文件: ${ref.sourceFileName}`);
    }
    
    if (ref.sourceRow !== undefined) {
      parts.push(`行: ${ref.sourceRow}`);
    }
    
    if (ref.sourceColumn) {
      parts.push(`列: ${ref.sourceColumn}`);
    }
    
    if (ref.originalValue !== undefined) {
      parts.push(`原始值: ${ref.originalValue}`);
    }
    
    return parts.join(', ');
  }

  public traceCalculationResult(result: CalculationResult): {
    resultId: string;
    sources: SourceInfo[];
    issues: TraceResult[];
  } {
    const sources: SourceInfo[] = result.sourceReferences.map(ref => ({
      type: ref.sourceType,
      typeName: sourceTypeNames[ref.sourceType] || ref.sourceType,
      id: ref.sourceId,
      fileName: ref.sourceFileName,
      location: this.formatLocation(ref),
      originalValue: ref.originalValue,
    }));

    const issues = result.issues.map(issue => this.traceIssue(issue));

    return {
      resultId: result.id,
      sources,
      issues,
    };
  }

  private formatLocation(ref: SourceReference): string | undefined {
    const parts: string[] = [];
    if (ref.sourceRow !== undefined) {
      parts.push(`行${ref.sourceRow}`);
    }
    if (ref.sourceColumn) {
      parts.push(`列${ref.sourceColumn}`);
    }
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  public getSourceInfo(ref: SourceReference): SourceInfo {
    return {
      type: ref.sourceType,
      typeName: sourceTypeNames[ref.sourceType] || ref.sourceType,
      id: ref.sourceId,
      fileName: ref.sourceFileName,
      location: this.formatLocation(ref),
      originalValue: ref.originalValue,
    };
  }

  public generateTraceReport(
    results: CalculationResult[]
  ): {
    totalResults: number;
    totalIssues: number;
    bySourceType: Record<string, number>;
    traces: Array<{
      accountId: string;
      resultId: string;
      status: string;
      sources: SourceInfo[];
      issues: TraceResult[];
    }>;
  } {
    const bySourceType: Record<string, number> = {};
    const traces = results.map(result => {
      const trace = this.traceCalculationResult(result);
      
      for (const source of trace.sources) {
        bySourceType[source.type] = (bySourceType[source.type] || 0) + 1;
      }

      return {
        accountId: result.accountId,
        resultId: result.id,
        status: result.status,
        sources: trace.sources,
        issues: trace.issues,
      };
    });

    const totalIssues = results.reduce(
      (sum, r) => sum + r.issues.length,
      0
    );

    return {
      totalResults: results.length,
      totalIssues,
      bySourceType,
      traces,
    };
  }

  public findSourceReferences(
    results: CalculationResult[],
    criteria: {
      sourceType?: DataSourceType;
      sourceFileName?: string;
      sourceId?: string;
    }
  ): CalculationResult[] {
    return results.filter(result =>
      result.sourceReferences.some(ref => {
        if (criteria.sourceType && ref.sourceType !== criteria.sourceType) {
          return false;
        }
        if (criteria.sourceFileName && ref.sourceFileName !== criteria.sourceFileName) {
          return false;
        }
        if (criteria.sourceId && ref.sourceId !== criteria.sourceId) {
          return false;
        }
        return true;
      })
    );
  }

  public groupIssuesBySource(results: CalculationResult[]): Record<string, {
    source: SourceReference;
    issues: ReconciliationIssue[];
    affectedResults: string[];
  }> {
    const groups: Record<string, {
      source: SourceReference;
      issues: ReconciliationIssue[];
      affectedResults: string[];
    }> = {};

    for (const result of results) {
      for (const issue of result.issues) {
        for (const ref of issue.sourceReferences) {
          const key = `${ref.sourceType}:${ref.sourceId}:${ref.sourceFileName || ''}:${ref.sourceRow || ''}`;
          
          if (!groups[key]) {
            groups[key] = {
              source: ref,
              issues: [],
              affectedResults: [],
            };
          }
          
          if (!groups[key].issues.some(i => i.id === issue.id)) {
            groups[key].issues.push(issue);
          }
          if (!groups[key].affectedResults.includes(result.id)) {
            groups[key].affectedResults.push(result.id);
          }
        }
      }
    }

    return groups;
  }

  public generateClickableTrace(ref: SourceReference): string {
    const params: string[] = [];
    
    params.push(`type=${ref.sourceType}`);
    params.push(`id=${encodeURIComponent(ref.sourceId)}`);
    
    if (ref.sourceFileName) {
      params.push(`file=${encodeURIComponent(ref.sourceFileName)}`);
    }
    if (ref.sourceRow !== undefined) {
      params.push(`row=${ref.sourceRow}`);
    }
    if (ref.sourceColumn) {
      params.push(`col=${encodeURIComponent(ref.sourceColumn)}`);
    }

    return `source://trace?${params.join('&')}`;
  }

  public parseClickableTrace(url: string): SourceReference | null {
    if (!url.startsWith('source://trace?')) {
      return null;
    }

    try {
      const queryString = url.substring('source://trace?'.length);
      const params = new URLSearchParams(queryString);
      
      const sourceType = params.get('type') as DataSourceType;
      const sourceId = params.get('id') || '';
      
      if (!sourceType || !sourceId) {
        return null;
      }

      const ref: SourceReference = {
        sourceType,
        sourceId,
      };

      const fileName = params.get('file');
      if (fileName) ref.sourceFileName = decodeURIComponent(fileName);
      
      const row = params.get('row');
      if (row !== null) ref.sourceRow = parseInt(row, 10);
      
      const col = params.get('col');
      if (col) ref.sourceColumn = decodeURIComponent(col);

      return ref;
    } catch {
      return null;
    }
  }

  public createSourceReference(
    sourceType: DataSourceType,
    sourceId: string,
    options?: {
      fileName?: string;
      row?: number;
      column?: string;
      originalValue?: string;
    }
  ): SourceReference {
    return {
      sourceType,
      sourceId,
      sourceFileName: options?.fileName,
      sourceRow: options?.row,
      sourceColumn: options?.column,
      originalValue: options?.originalValue,
    };
  }

  public printTrace(trace: TraceResult): string {
    const lines = [
      `问题ID: ${trace.issueId}`,
      `问题类型: ${trace.issueType}`,
      `严重程度: ${trace.severity}`,
      `问题描述: ${trace.issueMessage}`,
    ];

    if (trace.expectedValue !== undefined) {
      lines.push(`期望值: ${trace.expectedValue}`);
    }
    if (trace.actualValue !== undefined) {
      lines.push(`实际值: ${trace.actualValue}`);
    }

    lines.push('', '溯源路径:');
    
    for (const path of trace.tracePaths) {
      lines.push(`  ${path.description}`);
      const clickable = this.generateClickableTrace(path.sourceReference);
      lines.push(`    链接: ${clickable}`);
    }

    return lines.join('\n');
  }
}
