import { useExperimentStore } from '@/store/useExperimentStore';

export function useExperiments() {
  const {
    experiments,
    filters,
    setFilters,
    getFilteredExperiments,
    getExperimentById,
    getStepRecordsByExperimentId,
    getScoreSheetByExperimentId,
    getScriptVersionsByExperimentId,
    getAnomaliesByExperimentId,
    resolveAnomaly,
  } = useExperimentStore();

  return {
    experiments,
    filters,
    setFilters,
    getFilteredExperiments,
    getExperimentById,
    getStepRecordsByExperimentId,
    getScoreSheetByExperimentId,
    getScriptVersionsByExperimentId,
    getAnomaliesByExperimentId,
    resolveAnomaly,
  };
}
