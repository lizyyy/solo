import axios from 'axios';
import { ContentItem, DashboardStats, TimelineItem, CalendarEvent, ReviewAction, ChannelType } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const contentApi = {
  create: (data: {
    title: string;
    content: string;
    author: string;
    scheduledAt?: string;
    channels?: ChannelType[];
    idempotencyKey?: string;
  }) => api.post<{ success: boolean; code: number; message: string; data: ContentItem }>('/content', data),

  get: (id: string) => api.get<{ success: boolean; code: number; message: string; data: ContentItem }>(`/content/${id}`),

  list: (params?: { status?: string; page?: number; pageSize?: number }) => 
    api.get<{ success: boolean; code: number; message: string; data: { list: ContentItem[]; total: number } }>('/content', { params }),

  update: (id: string, data: {
    title?: string;
    content?: string;
    scheduledAt?: string;
    channels?: ChannelType[];
  }) => api.put<{ success: boolean; code: number; message: string; data: ContentItem }>(`/content/${id}`, data),

  submitForReview: (id: string, reviewer: string) => 
    api.post<{ success: boolean; code: number; message: string; data: ContentItem }>(`/content/${id}/submit-review`, { reviewer }),

  review: (id: string, data: {
    action: ReviewAction;
    reviewer: string;
    reason: string;
    remark?: string;
  }) => api.post<{ success: boolean; code: number; message: string; data: ContentItem }>(`/content/${id}/review`, data),

  retryPublish: (id: string) => 
    api.post<{ success: boolean; code: number; message: string; data: ContentItem }>(`/content/${id}/retry`),

  retryChannelSync: (channelId: string) => 
    api.post<{ success: boolean; code: number; message: string; data: any }>(`/channels/${channelId}/retry`),

  fixChannelSync: (channelId: string, data: { correction: string; operator: string }) => 
    api.post<{ success: boolean; code: number; message: string; data: any }>(`/channels/${channelId}/fix`, data),

  getDashboardStats: () => 
    api.get<{ success: boolean; code: number; message: string; data: DashboardStats }>('/dashboard/stats'),

  getTimeline: (contentId: string) => 
    api.get<{ success: boolean; code: number; message: string; data: TimelineItem[] }>(`/content/${contentId}/timeline`),

  getCalendar: (startDate: string, endDate: string) => 
    api.get<{ success: boolean; code: number; message: string; data: CalendarEvent[] }>('/calendar', {
      params: { startDate, endDate }
    }),

  exportCalendar: (startDate: string, endDate: string) => {
    window.open(`/api/calendar/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, '_blank');
  }
};

export default api;
