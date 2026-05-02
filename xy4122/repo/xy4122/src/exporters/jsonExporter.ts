import { format } from 'date-fns';
import {
  ReviewSession,
  ReportData,
} from '../types';

export class JSONExporter {
  export(session: ReviewSession, pretty: boolean = true): string {
    const reportData: ReportData = {
      session,
      generatedAt: new Date(),
      format: 'json',
    };

    const serialized = this.serializeDates(reportData);

    if (pretty) {
      return JSON.stringify(serialized, null, 2);
    }
    return JSON.stringify(serialized);
  }

  private serializeDates(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (obj instanceof Date) {
      return {
        __type: 'Date',
        iso: obj.toISOString(),
        formatted: format(obj, 'yyyy-MM-dd HH:mm:ss'),
      };
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeDates(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.serializeDates(value);
      }
      return result;
    }

    return obj;
  }

  exportSummary(session: ReviewSession): string {
    const summary = {
      sessionId: session.id,
      sessionName: session.name,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      analysis: {
        totalRecords: session.analysis.summary.totalRecords,
        totalAnomalies: session.analysis.summary.totalAnomalies,
        totalRiskFragments: session.analysis.summary.totalRiskFragments,
        affectedBatches: session.analysis.summary.affectedBatches,
        anomalyByType: session.analysis.summary.anomalyByType,
        riskByLevel: session.analysis.summary.riskByLevel,
        timeRange: {
          start: session.analysis.summary.timeRange.start.toISOString(),
          end: session.analysis.summary.timeRange.end.toISOString(),
        },
      },
      sourceFiles: session.sourceFiles.map(f => ({
        filename: f.filename,
        fileType: f.fileType,
        recordCount: f.recordCount,
        importedAt: f.importedAt.toISOString(),
      })),
    };

    return JSON.stringify(summary, null, 2);
  }
}
