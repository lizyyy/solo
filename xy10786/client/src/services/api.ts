import axios from 'axios';
import { ContentItem, DashboardStats, TimelineItem, CalendarEvent, ReviewAction, ChannelType } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
}

export const contentApi = {
  create: async (data: {
    title: string;
    content: string;
    author: string;
    scheduledAt?: string;
    channels?: ChannelType[];
    idempotencyKey?: string;
  }): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.post<ApiResponse<ContentItem>>('/content', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  get: async (id: string): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.get<ApiResponse<ContentItem>>(`/content/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  list: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<ApiResponse<{ list: ContentItem[]; total: number }>> => {
    try {
      const response = await api.get<ApiResponse<{ list: ContentItem[]; total: number }>>('/content', { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  update: async (id: string, data: {
    title?: string;
    content?: string;
    scheduledAt?: string;
    channels?: ChannelType[];
  }): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.put<ApiResponse<ContentItem>>(`/content/${id}`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  submitForReview: async (id: string, reviewer: string): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.post<ApiResponse<ContentItem>>(`/content/${id}/submit-review`, { reviewer });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  review: async (id: string, data: {
    action: ReviewAction;
    reviewer: string;
    reason: string;
    remark?: string;
  }): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.post<ApiResponse<ContentItem>>(`/content/${id}/review`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  retryPublish: async (id: string): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.post<ApiResponse<ContentItem>>(`/content/${id}/retry`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  retryChannelSync: async (channelId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post<ApiResponse<any>>(`/channels/${channelId}/retry`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  fixChannelSync: async (channelId: string, data: { correction: string; operator: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post<ApiResponse<any>>(`/channels/${channelId}/fix`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  publishNow: async (id: string): Promise<ApiResponse<ContentItem>> => {
    try {
      const response = await api.post<ApiResponse<ContentItem>>(`/content/${id}/publish-now`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  getDashboardStats: async (): Promise<ApiResponse<DashboardStats>> => {
    try {
      const response = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  getTimeline: async (contentId: string): Promise<ApiResponse<TimelineItem[]>> => {
    try {
      const response = await api.get<ApiResponse<TimelineItem[]>>(`/content/${contentId}/timeline`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  getCalendar: async (startDate: string, endDate: string): Promise<ApiResponse<CalendarEvent[]>> => {
    try {
      const response = await api.get<ApiResponse<CalendarEvent[]>>('/calendar', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  exportCalendar: (startDate: string, endDate: string) => {
    window.open(`/api/calendar/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, '_blank');
  }
};

export default api;
