import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { ExportRequest, ExportJob } from '@/types';

export const EXPORT_QUERY_KEYS = {
  all: ['exports'] as const,
  job: (jobId: string) => [...EXPORT_QUERY_KEYS.all, 'job', jobId] as const,
};

export function useExportJob(jobId: string) {
  return useQuery({
    queryKey: EXPORT_QUERY_KEYS.job(jobId),
    queryFn: async () => {
      return apiClient.get<ExportJob>(`/exports/${jobId}`);
    },
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (data?.status === 'pending' || data?.status === 'active') {
        return 2000;
      }
      return false;
    },
  });
}

export function useCreateExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ExportRequest) => {
      return apiClient.post<{ jobId: string }>('/exports', data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: EXPORT_QUERY_KEYS.job(data.jobId) 
      });
    },
  });
}

export function getDownloadUrl(jobId: string): string {
  return `/api/exports/${jobId}/download`;
}

export async function downloadExport(jobId: string, filename?: string): Promise<void> {
  const url = getDownloadUrl(jobId);
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  if (!response.ok) {
    throw new Error('下载失败');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename || `export-${jobId}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
