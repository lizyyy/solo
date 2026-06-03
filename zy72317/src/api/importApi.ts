import apiClient from './client';
import type { ImportResponse, ImportBatch, DuplicateCheckResponse } from '../../shared/types';

export const importApi = {
  importCSV: (file: File, operator: string, forceReimport: boolean = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('operator', operator);
    formData.append('forceReimport', String(forceReimport));
    return apiClient.post<ImportResponse>('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  checkDuplicate: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<DuplicateCheckResponse>('/import/check-duplicate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getBatches: () => {
    return apiClient.get<ImportBatch[]>('/import/batches');
  },
};
