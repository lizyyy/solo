import type { ApplicationState, BedAnalysis } from '../types';

const STORAGE_KEY = 'greenhouse_calibration_tool_state';
const ANALYSIS_OVERRIDES_KEY = 'greenhouse_calibration_analysis_overrides';

export const saveState = (state: ApplicationState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage:', e);
  }
};

export const loadState = (): ApplicationState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as ApplicationState;
    }
  } catch (e) {
    console.error('Failed to load state from localStorage:', e);
  }
  return null;
};

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ANALYSIS_OVERRIDES_KEY);
  } catch (e) {
    console.error('Failed to clear state from localStorage:', e);
  }
};

export const saveAnalysisOverrides = (analyses: BedAnalysis[]): void => {
  try {
    const overrides: Record<string, Partial<BedAnalysis>> = {};
    analyses.forEach(analysis => {
      if (analysis.manualOverride || analysis.notes) {
        overrides[analysis.bedId] = {
          manualOverride: analysis.manualOverride,
          notes: analysis.notes
        };
      }
    });
    localStorage.setItem(ANALYSIS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save analysis overrides:', e);
  }
};

export const loadAnalysisOverrides = (): Record<string, Partial<BedAnalysis>> => {
  try {
    const saved = localStorage.getItem(ANALYSIS_OVERRIDES_KEY);
    if (saved) {
      return JSON.parse(saved) as Record<string, Partial<BedAnalysis>>;
    }
  } catch (e) {
    console.error('Failed to load analysis overrides:', e);
  }
  return {};
};

export const mergeAnalysisWithOverrides = (
  analyses: BedAnalysis[]
): BedAnalysis[] => {
  const overrides = loadAnalysisOverrides();
  return analyses.map(analysis => {
    const override = overrides[analysis.bedId];
    if (override) {
      return {
        ...analysis,
        ...override
      };
    }
    return analysis;
  });
};
