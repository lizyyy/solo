import axios from 'axios';
import { TimeoutEvent, ResponseSummary, RetryBatch, SLARule, CallbackTarget, Statistics, CreateEventRequest } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getStatistics = (): Promise<Statistics> => 
  api.get('/statistics').then(res => res.data);

export const getSLARules = (): Promise<SLARule[]> =>
  api.get('/sla-rules').then(res => res.data);

export const getCallbackTargets = (): Promise<CallbackTarget[]> =>
  api.get('/callback-targets').then(res => res.data);

export const createTimeoutEvent = (data: CreateEventRequest): Promise<TimeoutEvent> =>
  api.post('/events', data).then(res => res.data);

export interface GetEventsParams {
  status?: string;
  ticketId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

export const getTimeoutEvents = (params?: GetEventsParams): Promise<{ events: TimeoutEvent[], total: number }> =>
  api.get('/events', { params }).then(res => res.data);

export const getTimeoutEvent = (id: string): Promise<TimeoutEvent> =>
  api.get(`/events/${id}`).then(res => res.data);

export const getResponseSummaries = (eventId: string): Promise<ResponseSummary[]> =>
  api.get(`/events/${eventId}/responses`).then(res => res.data);

export const retryEvent = (id: string, reason: string, triggeredBy: string): Promise<RetryBatch> =>
  api.post(`/events/${id}/retry`, { reason, triggeredBy }).then(res => res.data);

export const createRetryBatch = (data: { eventIds: string[], reason: string, triggeredBy: string }): Promise<RetryBatch> =>
  api.post('/retry-batches', data).then(res => res.data);

export const getRetryBatches = (): Promise<RetryBatch[]> =>
  api.get('/retry-batches').then(res => res.data);

export const exportEvents = (params?: GetEventsParams): Promise<void> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  window.open(`/api/export/events?${queryString}`, '_blank');
  return Promise.resolve();
};
