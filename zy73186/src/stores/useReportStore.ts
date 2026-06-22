import { create } from 'zustand';
import type { Report } from '../types';
import { persistenceService } from '../services/persistence';

interface ReportState {
  reports: Report[];
  currentReport: Report | null;
  isLoading: boolean;
  error: string | null;

  loadAllReports: () => Promise<void>;
  loadReportsForSession: (sessionId: string) => Promise<Report[]>;
  loadReport: (reportId: string) => Promise<Report | null>;
  addReport: (report: Report) => void;
  setCurrentReport: (report: Report | null) => void;
  clearReports: () => void;
  clearError: () => void;
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  currentReport: null,
  isLoading: false,
  error: null,

  loadAllReports: async () => {
    set({ isLoading: true, error: null });
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('getAllSessions for reports timeout')), 5000);
      });
      const sessions = await Promise.race([
        persistenceService.getAllSessions(),
        timeoutPromise,
      ]);
      const allReports: Report[] = [];
      for (const session of sessions) {
        const sessionTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('getReportsBySession timeout')), 5000);
        });
        const sessionReports = await Promise.race([
          persistenceService.getReportsBySession(session.id),
          sessionTimeoutPromise,
        ]);
        allReports.push(...sessionReports);
      }
      if (allReports.length > 0) {
        set({ reports: allReports, isLoading: false });
        return;
      }
      const { reports: existingReports } = get();
      if (existingReports.length > 0) {
        console.log('[ReportStore] Store already has hydrated reports, keeping:', existingReports.length);
        set({ isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.reports && backup.reports.length > 0) {
            console.log('[ReportStore] Falling back to localStorage reports:', backup.reports.length);
            set({ reports: backup.reports, isLoading: false });
            return;
          }
        }
      } catch (e) {
        console.warn('[ReportStore] Failed to load from localStorage backup:', e);
      }
      set({ isLoading: false });
    } catch (error) {
      console.warn('[ReportStore] loadAllReports failed:', error);
      const { reports: existingReports } = get();
      if (existingReports.length > 0) {
        console.log('[ReportStore] Store already has hydrated reports, keeping:', existingReports.length);
        set({ error: (error as Error).message, isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.reports && backup.reports.length > 0) {
            console.log('[ReportStore] Falling back to localStorage reports:', backup.reports.length);
            set({ reports: backup.reports, error: (error as Error).message, isLoading: false });
            return;
          }
        }
      } catch (e) {
        console.warn('[ReportStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadReportsForSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('getReportsBySession timeout')), 5000);
      });
      const sessionReports = await Promise.race([
        persistenceService.getReportsBySession(sessionId),
        timeoutPromise,
      ]);
      if (sessionReports && sessionReports.length > 0) {
        if (sessionReports[0]) {
          set({ currentReport: sessionReports[0] });
        }
        set({ reports: sessionReports, isLoading: false });
        return sessionReports;
      }
      const { reports: existingReports } = get();
      const filtered = existingReports.filter((r) => r.sessionId === sessionId);
      if (filtered.length > 0) {
        console.log('[ReportStore] Store already has session reports, keeping:', filtered.length);
        if (filtered[0]) {
          set({ currentReport: filtered[0] });
        }
        set({ isLoading: false });
        return filtered;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.reports && backup.reports.length > 0) {
            const backupFiltered = backup.reports.filter((r: Report) => r.sessionId === sessionId);
            if (backupFiltered.length > 0) {
              console.log('[ReportStore] Falling back to localStorage session reports:', backupFiltered.length);
              if (backupFiltered[0]) {
                set({ currentReport: backupFiltered[0] });
              }
              set({ reports: backupFiltered, isLoading: false });
              return backupFiltered;
            }
          }
        }
      } catch (e) {
        console.warn('[ReportStore] Failed to load from localStorage backup:', e);
      }
      set({ isLoading: false });
      return [];
    } catch (error) {
      console.warn('[ReportStore] loadReportsForSession failed:', error);
      const { reports: existingReports } = get();
      const filtered = existingReports.filter((r) => r.sessionId === sessionId);
      if (filtered.length > 0) {
        console.log('[ReportStore] Store already has session reports, keeping:', filtered.length);
        if (filtered[0]) {
          set({ currentReport: filtered[0] });
        }
        set({ error: (error as Error).message, isLoading: false });
        return filtered;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.reports && backup.reports.length > 0) {
            const backupFiltered = backup.reports.filter((r: Report) => r.sessionId === sessionId);
            if (backupFiltered.length > 0) {
              console.log('[ReportStore] Falling back to localStorage session reports:', backupFiltered.length);
              if (backupFiltered[0]) {
                set({ currentReport: backupFiltered[0] });
              }
              set({ reports: backupFiltered, error: (error as Error).message, isLoading: false });
              return backupFiltered;
            }
          }
        }
      } catch (e) {
        console.warn('[ReportStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
      return [];
    }
  },

  loadReport: async (reportId: string) => {
    set({ isLoading: true, error: null });
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('getReport timeout')), 5000);
      });
      const report = await Promise.race([
        persistenceService.getReport(reportId),
        timeoutPromise,
      ]);
      if (report) {
        set({ currentReport: report, isLoading: false });
        return report;
      }
      const { reports: existingReports } = get();
      const existing = existingReports.find((r) => r.id === reportId);
      if (existing) {
        console.log('[ReportStore] Store already has this report in memory');
        set({ currentReport: existing, isLoading: false });
        return existing;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.reports && backup.reports.length > 0) {
            const backupReport = backup.reports.find((r: Report) => r.id === reportId);
            if (backupReport) {
              console.log('[ReportStore] Falling back to localStorage single report');
              set({ currentReport: backupReport, isLoading: false });
              return backupReport;
            }
          }
        }
      } catch (e) {
        console.warn('[ReportStore] Failed to load from localStorage backup:', e);
      }
      set({ error: '报告不存在', isLoading: false });
      return null;
    } catch (error) {
      console.warn('[ReportStore] loadReport failed:', error);
      const { reports: existingReports } = get();
      const existing = existingReports.find((r) => r.id === reportId);
      if (existing) {
        console.log('[ReportStore] Store already has this report in memory');
        set({ currentReport: existing, error: (error as Error).message, isLoading: false });
        return existing;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.reports && backup.reports.length > 0) {
            const backupReport = backup.reports.find((r: Report) => r.id === reportId);
            if (backupReport) {
              console.log('[ReportStore] Falling back to localStorage single report');
              set({ currentReport: backupReport, error: (error as Error).message, isLoading: false });
              return backupReport;
            }
          }
        }
      } catch (e) {
        console.warn('[ReportStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  addReport: (report: Report) => {
    set((state) => ({
      reports: [report, ...state.reports],
      currentReport: report,
    }));
  },

  setCurrentReport: (report: Report | null) => {
    set({ currentReport: report });
  },

  clearReports: () => set({ reports: [], currentReport: null }),

  clearError: () => set({ error: null }),
}));
