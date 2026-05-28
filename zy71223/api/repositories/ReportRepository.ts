import { db, saveDatabase, generateId } from '../db/init';
import type { CollationReport, ReportItem } from '../../shared/types';

export class ReportRepository {
  static findAll(): CollationReport[] {
    return db.collationReport
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(r => ({
        ...r,
        items: this.findItemsByReportId(r.id),
      }));
  }

  static findById(id: string): CollationReport | null {
    const report = db.collationReport.find(r => r.id === id);
    if (!report) return null;
    return {
      ...report,
      items: this.findItemsByReportId(id),
    };
  }

  static findItemsByReportId(reportId: string): ReportItem[] {
    return db.reportItem
      .filter(i => i.reportId === reportId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  static create(data: Omit<CollationReport, 'id' | 'createdAt' | 'items'> & {
    items: Omit<ReportItem, 'id' | 'reportId'>[];
  }): CollationReport {
    const id = generateId('rep');
    const now = new Date().toISOString();

    const report: CollationReport = {
      ...data,
      id,
      createdAt: now,
      items: [],
    };

    db.collationReport.push(report);

    for (const item of data.items) {
      const itemId = generateId('ritm');
      db.reportItem.push({
        ...item,
        id: itemId,
        reportId: id,
      });
    }

    saveDatabase();
    return this.findById(id)!;
  }

  static logExport(data: {
    reportId?: string;
    voucherId?: string;
    exportType: string;
    fileName: string;
    filePath: string;
    exportedBy: string;
  }): void {
    const id = generateId('exp');
    const now = new Date().toISOString();
    db.exportLog.push({
      id,
      reportId: data.reportId || null,
      voucherId: data.voucherId || null,
      exportType: data.exportType,
      fileName: data.fileName,
      filePath: data.filePath,
      exportedBy: data.exportedBy,
      exportedAt: now,
    });
    saveDatabase();
  }

  static getExportLogs(reportId?: string) {
    let logs = [...db.exportLog];
    if (reportId) {
      logs = logs.filter(l => l.reportId === reportId);
    }
    return logs
      .sort((a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime())
      .map(l => {
        const report = db.collationReport.find(r => r.id === l.reportId);
        return {
          ...l,
          report_period: report?.period,
        };
      });
  }
}
