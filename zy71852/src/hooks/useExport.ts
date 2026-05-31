import { useState, useCallback } from 'react';
import type { Experiment, StepRecord, ScoreSheet, ScriptVersion, Anomaly } from '@/types';
import { exportToExcel, exportToPDF, checkConsistency, type ExportOptions, type ConsistencyCheckResult } from '@/utils/export';

export function useExport(
  experiment: Experiment | undefined,
  stepRecords: StepRecord[],
  scoreSheet: ScoreSheet | undefined,
  anomalies: Anomaly[],
  scriptVersions: ScriptVersion[]
) {
  const [isExporting, setIsExporting] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<ConsistencyCheckResult | null>(null);

  const runConsistencyCheck = useCallback((): ConsistencyCheckResult => {
    const result = checkConsistency(stepRecords, scoreSheet);
    setConsistencyResult(result);
    return result;
  }, [stepRecords, scoreSheet]);

  const handleExportExcel = useCallback(
    async (options: ExportOptions) => {
      if (!experiment) return;
      setIsExporting(true);
      try {
        runConsistencyCheck();
        await exportToExcel(experiment, stepRecords, scoreSheet, anomalies, scriptVersions, options);
      } finally {
        setIsExporting(false);
      }
    },
    [experiment, stepRecords, scoreSheet, anomalies, scriptVersions, runConsistencyCheck]
  );

  const handleExportPDF = useCallback(
    async (elementId: string, fileName: string) => {
      setIsExporting(true);
      try {
        runConsistencyCheck();
        await exportToPDF(elementId, fileName);
      } finally {
        setIsExporting(false);
      }
    },
    [runConsistencyCheck]
  );

  return {
    isExporting,
    consistencyResult,
    runConsistencyCheck,
    handleExportExcel,
    handleExportPDF,
  };
}
