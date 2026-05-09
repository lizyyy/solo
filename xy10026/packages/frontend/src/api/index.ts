import axios from 'axios';
import { LiveMessage, MessageType, MessageStatus } from '@live-push/shared';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const traceId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  config.headers['x-trace-id'] = traceId;
  return config;
});

export interface CreateMessageParams {
  roomId: string;
  type: MessageType;
  content: string;
  senderId: string;
  senderName: string;
  metadata?: Record<string, unknown>;
  operatorId?: string;
  operatorName?: string;
  idempotencyKey?: string;
}

export interface UpdateMessageParams {
  content?: string;
  metadata?: Record<string, unknown>;
  expectedVersion?: number;
  operatorId: string;
  operatorName: string;
  reason?: string;
}

export interface GetMessagesParams {
  roomId: string;
  limit?: number;
  offset?: number;
  status?: MessageStatus;
  type?: MessageType;
  startTime?: string;
  endTime?: string;
}

export const messageApi = {
  create: (params: CreateMessageParams) =>
    api.post<{ message: LiveMessage; isDuplicate: boolean }>('/messages', params),

  getList: (params: GetMessagesParams) =>
    api.get<{ messages: LiveMessage[]; total: number }>(`/messages/room/${params.roomId}`, {
      params: {
        limit: params.limit,
        offset: params.offset,
        status: params.status,
        type: params.type,
        startTime: params.startTime,
        endTime: params.endTime,
      },
    }),

  getById: (messageId: string) =>
    api.get<LiveMessage>(`/messages/${messageId}`),

  update: (messageId: string, params: UpdateMessageParams) =>
    api.put<LiveMessage>(`/messages/${messageId}`, params),

  delete: (messageId: string, params: { operatorId: string; operatorName: string; reason?: string }) =>
    api.delete(`/messages/${messageId}`, { data: params }),

  retry: (messageId: string, params: { operatorId: string; operatorName: string; traceId?: string }) =>
    api.post<LiveMessage>(`/messages/${messageId}/retry`, params),

  rollback: (messageId: string, params: { operatorId: string; operatorName: string; reason: string; traceId?: string }) =>
    api.post<LiveMessage>(`/messages/${messageId}/rollback`, params),
};

export const replayApi = {
  replayMessage: (messageId: string, params?: {
    speed?: number;
    startVersion?: number;
    endVersion?: number;
    dryRun?: boolean;
  }) =>
    api.get(`/replay/message/${messageId}`, { params }),

  replayByTrace: (traceId: string) =>
    api.get(`/replay/trace/${traceId}`),

  compareStates: (messageId: string, version1: number, version2: number) =>
    api.get(`/replay/message/${messageId}/compare`, {
      params: { version1, version2 },
    }),

  getExecutionPath: (messageId: string) =>
    api.get(`/replay/message/${messageId}/path`),

  diagnose: (messageId: string) =>
    api.get(`/replay/message/${messageId}/diagnose`),
};

export const reportApi = {
  generate: (params: { roomId: string; startDate: string; endDate: string }) =>
    api.post('/reports/generate', params),

  export: (params: {
    roomId: string;
    startDate: string;
    endDate: string;
    format: 'excel' | 'markdown' | 'pdf';
  }) =>
    api.get('/reports/export', {
      params,
      responseType: 'blob',
    }),
};

export default api;
