import api from './index';
import type {
  RiskDashboardStats,
  VersionCompareResult,
  RegressionAnalysis,
  BusinessDataType,
  ApiResponse,
} from '../../shared/types';

export const riskService = {
  getRiskDashboard: () => {
    return api.get<unknown, ApiResponse<RiskDashboardStats>>('/risk/dashboard');
  },

  versionCompare: (
    recordId: string,
    recordType: BusinessDataType,
    version1: number,
    version2: number
  ) => {
    const params = new URLSearchParams();
    params.append('recordId', recordId);
    params.append('recordType', recordType);
    params.append('version1', version1.toString());
    params.append('version2', version2.toString());
    
    return api.get<unknown, ApiResponse<VersionCompareResult>>(
      `/risk/version-compare?${params.toString()}`
    );
  },

  getRegressionAnalysis: () => {
    return api.get<unknown, ApiResponse<RegressionAnalysis[]>>('/risk/regression');
  },
};
