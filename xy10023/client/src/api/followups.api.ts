import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { 
  FollowUp, 
  FollowUpStats, 
  CreateFollowUpDto, 
  CompleteFollowUpDto,
  FollowUpStatus,
  FollowUpType 
} from '@/types';

export const FOLLOWUP_QUERY_KEYS = {
  all: ['followups'] as const,
  list: (filters?: Record<string, unknown>) => [...FOLLOWUP_QUERY_KEYS.all, 'list', filters] as const,
  detail: (id: string) => [...FOLLOWUP_QUERY_KEYS.all, 'detail', id] as const,
  pending: (assigneeId?: string) => [...FOLLOWUP_QUERY_KEYS.all, 'pending', assigneeId] as const,
  overdue: () => [...FOLLOWUP_QUERY_KEYS.all, 'overdue'] as const,
  stats: () => [...FOLLOWUP_QUERY_KEYS.all, 'stats'] as const,
};

export function useFollowUp(id: string) {
  return useQuery({
    queryKey: FOLLOWUP_QUERY_KEYS.detail(id),
    queryFn: async () => {
      return apiClient.get<FollowUp>(`/followups/${id}`);
    },
    enabled: !!id,
  });
}

export function usePendingFollowUps(assigneeId?: string) {
  return useQuery({
    queryKey: FOLLOWUP_QUERY_KEYS.pending(assigneeId),
    queryFn: async () => {
      const params = assigneeId ? { assigneeId } : {};
      const response = await apiClient.get<{ followUps: FollowUp[] }>('/followups/pending', params);
      return response.followUps;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useOverdueFollowUps() {
  return useQuery({
    queryKey: FOLLOWUP_QUERY_KEYS.overdue(),
    queryFn: async () => {
      const response = await apiClient.get<{ followUps: FollowUp[] }>('/followups/overdue');
      return response.followUps;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useFollowUpStats() {
  return useQuery({
    queryKey: FOLLOWUP_QUERY_KEYS.stats(),
    queryFn: async () => {
      return apiClient.get<FollowUpStats>('/followups/stats');
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useCreateFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFollowUpDto) => {
      return apiClient.post<FollowUp>('/followups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_QUERY_KEYS.all });
    },
  });
}

export function useUpdateFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateFollowUpDto> }) => {
      return apiClient.put<FollowUp>(`/followups/${id}`, data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: FOLLOWUP_QUERY_KEYS.detail(variables.id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: FOLLOWUP_QUERY_KEYS.all,
        exact: false 
      });
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompleteFollowUpDto }) => {
      return apiClient.post<FollowUp>(`/followups/${id}/complete`, data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: FOLLOWUP_QUERY_KEYS.detail(variables.id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: FOLLOWUP_QUERY_KEYS.all,
        exact: false 
      });
    },
  });
}

export function useCompensateFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Record<string, unknown> 
    }) => {
      return apiClient.post<FollowUp>(`/followups/${id}/compensate`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_QUERY_KEYS.all });
    },
  });
}

export function invalidateFollowUpQueries(queryClient: QueryClient, followUpId?: string) {
  if (followUpId) {
    queryClient.invalidateQueries({ queryKey: FOLLOWUP_QUERY_KEYS.detail(followUpId) });
  }
  queryClient.invalidateQueries({ queryKey: FOLLOWUP_QUERY_KEYS.all, exact: false });
}
