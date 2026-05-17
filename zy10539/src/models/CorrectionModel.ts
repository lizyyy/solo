import type {
  CorrectionRequest,
  CorrectionReport,
  ExceptionRecord,
  RollbackPoint
} from '../types';

class CorrectionStorage {
  private corrections: Map<string, CorrectionRequest> = new Map();
  private reports: Map<string, CorrectionReport> = new Map();
  private exceptions: Map<string, ExceptionRecord> = new Map();
  private rollbackPoints: Map<string, RollbackPoint> = new Map();

  async saveCorrection(correction: CorrectionRequest): Promise<CorrectionRequest> {
    this.corrections.set(correction.id, {
      ...correction,
      updatedAt: new Date()
    });
    return this.corrections.get(correction.id)!;
  }

  async getCorrection(id: string): Promise<CorrectionRequest | undefined> {
    return this.corrections.get(id);
  }

  async listCorrections(filters?: {
    status?: string;
    applicant?: string;
    department?: string;
  }): Promise<CorrectionRequest[]> {
    let results = Array.from(this.corrections.values());
    
    if (filters?.status) {
      results = results.filter(c => c.status === filters.status);
    }
    if (filters?.applicant) {
      results = results.filter(c => c.applicant === filters.applicant);
    }
    if (filters?.department) {
      results = results.filter(c => c.applicantDepartment === filters.department);
    }
    
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveReport(report: CorrectionReport): Promise<CorrectionReport> {
    this.reports.set(report.id, report);
    return report;
  }

  async getReport(id: string): Promise<CorrectionReport | undefined> {
    return this.reports.get(id);
  }

  async getReportsByCorrection(correctionId: string): Promise<CorrectionReport[]> {
    return Array.from(this.reports.values())
      .filter(r => r.correctionId === correctionId)
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  async saveException(exception: ExceptionRecord): Promise<ExceptionRecord> {
    this.exceptions.set(exception.id, exception);
    return exception;
  }

  async getExceptionsByCorrection(correctionId: string): Promise<ExceptionRecord[]> {
    return Array.from(this.exceptions.values())
      .filter(e => e.correctionId === correctionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async saveRollbackPoint(point: RollbackPoint): Promise<RollbackPoint> {
    this.rollbackPoints.set(point.id, point);
    return point;
  }

  async getRollbackPointsByCorrection(correctionId: string): Promise<RollbackPoint[]> {
    return Array.from(this.rollbackPoints.values())
      .filter(r => r.correctionId === correctionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const correctionStorage = new CorrectionStorage();
