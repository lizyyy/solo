import { create } from 'zustand';
import type {
  ComplianceReport,
  ReportFormat,
  ExportRecord,
} from '../types';
import { db } from '../db';
import { reportGenerator } from '../services/reportGenerator';

interface ReportState {
  reports: ComplianceReport[];
  currentReport: ComplianceReport | null;
  exportHistory: ExportRecord[];
  loading: boolean;
  generating: boolean;
  exporting: boolean;
  verifying: boolean;
  error: string | null;
  loadReports: (projectId: string) => Promise<void>;
  loadExportHistory: (projectId: string) => Promise<void>;
  generateReport: (projectId: string, options?: { title?: string; notes?: string }) => Promise<ComplianceReport>;
  setCurrentReport: (report: ComplianceReport | null) => void;
  exportReport: (
    reportId: string,
    format: ReportFormat
  ) => Promise<ExportRecord>;
  verifyReport: (reportId: string) => Promise<boolean>;
  deleteReport: (reportId: string) => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  currentReport: null,
  exportHistory: [],
  loading: false,
  generating: false,
  exporting: false,
  verifying: false,
  error: null,

  loadReports: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const reports = await db.reports
        .where('projectId')
        .equals(projectId)
        .reverse()
        .sortBy('generatedAt');
      set({ reports, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadExportHistory: async (projectId: string) => {
    try {
      const history = await reportGenerator.getExportHistory(projectId);
      set({ exportHistory: history });
    } catch (error) {
      console.error('Failed to load export history:', error);
    }
  },

  generateReport: async (projectId: string, options?: { title?: string; notes?: string }) => {
    set({ generating: true, error: null });
    try {
      const report = await reportGenerator.generate(projectId);
      if (options?.title) {
        await db.reports.update(report.id, {
          title: options.title,
          notes: options.notes,
        });
        report.title = options.title;
        report.notes = options.notes;
      }
      await get().loadReports(projectId);
      set({ currentReport: report, generating: false });
      return report;
    } catch (error) {
      set({ error: (error as Error).message, generating: false });
      throw error;
    }
  },

  setCurrentReport: (report: ComplianceReport | null) => {
    set({ currentReport: report });
  },

  exportReport: async (reportId: string, format: ReportFormat) => {
    set({ exporting: true, error: null });
    try {
      const exportRecord = await reportGenerator.exportReport(reportId, format);
      const report = get().reports.find((r) => r.id === reportId);
      if (report) {
        const projectId = report.projectId;
        await get().loadExportHistory(projectId);
      }
      set({ exporting: false });
      return exportRecord;
    } catch (error) {
      set({ error: (error as Error).message, exporting: false });
      throw error;
    }
  },

  verifyReport: async (reportId: string) => {
    set({ verifying: true, error: null });
    try {
      const isValid = await reportGenerator.verifyReport(reportId);
      set({ verifying: false });
      return isValid;
    } catch (error) {
      set({ error: (error as Error).message, verifying: false });
      return false;
    }
  },

  deleteReport: async (reportId: string) => {
    await db.transaction(
      'rw',
      [db.reports, db.reportEntries, db.exports],
      async () => {
        await db.reportEntries.where('reportId').equals(reportId).delete();
        await db.exports.where('reportId').equals(reportId).delete();
        await db.reports.delete(reportId);
      }
    );

    set((state) => ({
      reports: state.reports.filter((r) => r.id !== reportId),
      currentReport:
        get().currentReport?.id === reportId ? null : get().currentReport,
      exportHistory: state.exportHistory.filter((e) => e.reportId !== reportId),
    }));
  },
}));
