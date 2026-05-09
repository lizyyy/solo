import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { 
  Ticket, 
  TicketStats, 
  CreateTicketDto, 
  UpdateTicketDto, 
  TicketStatus,
  TicketPriority,
  Event,
  PaginatedResponse 
} from '@/types';

export const TICKET_QUERY_KEYS = {
  all: ['tickets'] as const,
  list: (filters?: Record<string, unknown>) => [...TICKET_QUERY_KEYS.all, 'list', filters] as const,
  detail: (id: string) => [...TICKET_QUERY_KEYS.all, 'detail', id] as const,
  stats: () => [...TICKET_QUERY_KEYS.all, 'stats'] as const,
  events: (id: string) => [...TICKET_QUERY_KEYS.all, 'events', id] as const,
};

export interface TicketListParams {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assigneeId?: string;
  customerId?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export function useTickets(params?: TicketListParams) {
  return useQuery({
    queryKey: TICKET_QUERY_KEYS.list(params),
    queryFn: async () => {
      const response = await apiClient.get<{
        tickets: Ticket[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>('/tickets', params as Record<string, unknown>);
      return response;
    },
    staleTime: 30000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: TICKET_QUERY_KEYS.detail(id),
    queryFn: async () => {
      return apiClient.get<Ticket>(`/tickets/${id}`);
    },
    enabled: !!id,
    staleTime: 60000,
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: TICKET_QUERY_KEYS.stats(),
    queryFn: async () => {
      return apiClient.get<TicketStats>('/tickets/stats');
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useTicketEvents(ticketId: string) {
  return useQuery({
    queryKey: TICKET_QUERY_KEYS.events(ticketId),
    queryFn: async () => {
      const response = await apiClient.get<{ events: Event[] }>(`/tickets/${ticketId}/events`);
      return response.events;
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTicketDto) => {
      return apiClient.post<Ticket>('/tickets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TICKET_QUERY_KEYS.all });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTicketDto }) => {
      return apiClient.put<Ticket>(`/tickets/${id}`, data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: TICKET_QUERY_KEYS.detail(variables.id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: TICKET_QUERY_KEYS.all,
        exact: false 
      });
    },
  });
}

export function useChangeTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      version,
      reason,
    }: {
      id: string;
      status: TicketStatus;
      version: number;
      reason?: string;
    }) => {
      return apiClient.patch<Ticket>(`/tickets/${id}/status`, {
        status,
        version,
        reason,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: TICKET_QUERY_KEYS.detail(variables.id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: TICKET_QUERY_KEYS.all,
        exact: false 
      });
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      assigneeId,
      version,
    }: {
      id: string;
      assigneeId: string | null;
      version: number;
    }) => {
      return apiClient.patch<Ticket>(`/tickets/${id}/assign`, {
        assigneeId,
        version,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: TICKET_QUERY_KEYS.detail(variables.id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: TICKET_QUERY_KEYS.all,
        exact: false 
      });
    },
  });
}

export function useReplayTicket() {
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      return apiClient.get<{ state: Record<string, unknown>; events: Event[] }>(
        `/tickets/${id}/replay`,
        { version }
      );
    },
  });
}

export function invalidateTicketQueries(queryClient: QueryClient, ticketId?: string) {
  if (ticketId) {
    queryClient.invalidateQueries({ queryKey: TICKET_QUERY_KEYS.detail(ticketId) });
  }
  queryClient.invalidateQueries({ queryKey: TICKET_QUERY_KEYS.all, exact: false });
}
