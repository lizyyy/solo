import { useState, useCallback } from 'react';
import type { Report } from '../types';
import { useSessionStore } from '../stores/useSessionStore';
import { useMaterialStore } from '../stores/useMaterialStore';
import { useComputationStore } from '../stores/useComputationStore';
import { useAuditStore } from '../stores/useAuditStore';
import { useReportStore } from '../stores/useReportStore';
import { reportGenerator } from '../services/reportGenerator';
import { persistenceService } from '../services/persistence';
import { auditLogger } from '../services/auditLogger';

export function useReportGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { reports, currentReport, loadAllReports, loadReport, loadReportsForSession, addReport, setCurrentReport } = useReportStore();

  const { currentSession, setSessionStatus } = useSessionStore();
  const { materials } = useMaterialStore();
  const { steps } = useComputationStore();
  const { logs, addLog, suspendedTasks } = useAuditStore();

  const generateReport = useCallback(async (
    session?: typeof currentSession,
    materialList?: typeof materials,
    stepList?: typeof steps,
    logList?: typeof logs,
    operator?: string,
    suspendedTaskList?: typeof suspendedTasks
  ) => {
    const targetSession = session || currentSession;
    const targetMaterials = materialList || materials;
    const targetSteps = stepList || steps;
    const targetLogs = logList || logs;
    const targetSuspendedTasks = suspendedTaskList || suspendedTasks;

    if (!targetSession) {
      setError('请先创建或选择一个会话');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const sessionSuspendedTasks = targetSuspendedTasks.filter(
        (t) => t.sessionId === targetSession.id
      );

      const report = reportGenerator.generate(
        targetSession,
        targetMaterials,
        targetSteps,
        targetLogs,
        operator,
        sessionSuspendedTasks
      );

      await persistenceService.saveReport(report);

      const log = auditLogger.logGenerateReport(
        targetSession.id,
        report.id
      );
      await addLog(log);

      await setSessionStatus('completed');

      addReport(report);
      return report;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [currentSession, materials, steps, logs, addLog, setSessionStatus, suspendedTasks, addReport]);

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

  const clearError = useCallback(() => setError(null), []);
  const clearReport = useCallback(() => setCurrentReport(null), [setCurrentReport]);

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
