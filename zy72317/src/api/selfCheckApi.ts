import apiClient from './client';
import type { SelfCheckResult } from '../../shared/types';

export const selfCheckApi = {
  runSelfCheck: () => {
    return apiClient.get<SelfCheckResult>('/self-check');
  },
};
