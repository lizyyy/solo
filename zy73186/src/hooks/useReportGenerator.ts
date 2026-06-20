import { useState, useCallback } from 'react';
import type { Report } from '../types';
import { useSessionStore } from '../stores/useSessionStore';
import { useMaterialStore } from '../stores/useMaterialStore';
import { useComputationStore } from '../stores/useComputationStore';
import { useAuditStore } from '../stores/useAuditStore';
import { reportGenerator } from '../services/reportGenerator';
import { persistenceService } from '../services/persistence';
import { auditLogger } from '../services/auditLogger';

export function useReportGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { currentSession, setSessionStatus } = useSessionStore();
  const { materials } = useMaterialStore();
  const { steps } = useComputationStore();
  const { logs, addLog } = useAuditStore();

  const generateReport = useCallback(async (
    session?: typeof currentSession,
    materialList?: typeof materials,
    stepList?: typeof steps,
    logList?: typeof logs,
    operator?: string
  ) => {
    const targetSession = session || currentSession;
    const targetMaterials = materialList || materials;
    const targetSteps = stepList || steps;
    const targetLogs = logList || logs;

    if (!targetSession) {
      setError('请先创建或选择一个会话');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const report = reportGenerator.generate(
        targetSession,
        targetMaterials,
        targetSteps,
        targetLogs,
        operator
      );

      await persistenceService.saveReport(report);

      const log = auditLogger.logGenerateReport(
        targetSession.id,
        report.id
      );
      await addLog(log);

      await setSessionStatus('completed');

      setCurrentReport(report);
      setReports((prev) => [report, ...prev]);
      return report;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [currentSession, materials, steps, logs, addLog, setSessionStatus]);

  const downloadReport = useCallback(
    (reportOrFormat?: Report | 'md' | 'json', format: 'md' | 'json' = 'md') => {
      let targetReport: Report | null = currentReport;
      let targetFormat: 'md' | 'json' = 'md';
      
      if (typeof reportOrFormat === 'string') {
        targetFormat = reportOrFormat;
      } else if (reportOrFormat) {
        targetReport = reportOrFormat;
        targetFormat = format;
      }
      
      if (targetReport) {
        reportGenerator.downloadReport(targetReport, targetFormat);
      }
    },
    [currentReport]
  );

  const loadReport = useCallback(async (reportId: string) => {
    setIsGenerating(true);
    try {
      const report = await persistenceService.getReport(reportId);
      setCurrentReport(report);
      return report;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const loadReportsForSession = useCallback(async (sessionId: string) => {
    setIsGenerating(true);
    try {
      const sessionReports = await persistenceService.getReportsBySession(sessionId);
      if (sessionReports.length > 0) {
        setCurrentReport(sessionReports[0]);
      }
      setReports(sessionReports);
      return sessionReports;
    } catch (err) {
      setError((err as Error).message);
      return [];
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const loadAllReports = useCallback(async () => {
    setIsGenerating(true);
    try {
      const sessions = await persistenceService.getAllSessions();
      const allReports: Report[] = [];
      for (const session of sessions) {
        const sessionReports = await persistenceService.getReportsBySession(session.id);
        allReports.push(...sessionReports);
      }
      setReports(allReports);
      return allReports;
    } catch (err) {
      setError((err as Error).message);
      return [];
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearReport = useCallback(() => setCurrentReport(null), []);

  return {
    isGenerating,
    currentReport,
    reports,
    error,
    generateReport,
    downloadReport,
    loadReport,
    loadReportsForSession,
    loadAllReports,
    clearError,
    clearReport,
  };
}
