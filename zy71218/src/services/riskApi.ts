import { get } from './api';
import type { RiskDashboardStats, VersionCompareResult, RegressionAnalysis } from '../../shared/types';

export const getDashboardStats = (period?: string): Promise<RiskDashboardStats> => {
  return get('/risk/dashboard', { period });
};

export const compareVersions = (
  recordId: string,
  version1: number,
  version2: number
): Promise<VersionCompareResult> => {
  return get('/risk/compare-versions', { recordId, version1, version2 });
};

export const analyzeRegression = (businessNo: string): Promise<RegressionAnalysis> => {
  return get(`/risk/regression/${businessNo}`);
};
