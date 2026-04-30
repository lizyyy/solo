import {
  Ticket,
  TicketWithDetails,
  Comment,
  CreateTicketRequest,
  UpdateTicketRequest,
  UpdateStatusRequest,
  CreateCommentRequest,
  FilterParams,
  Metadata,
  ImportResult,
  ApiResponse,
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

export const ticketApi = {
  getTickets: async (filters?: FilterParams): Promise<Ticket[]> => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value);
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `/tickets?${queryString}` : '/tickets';
    const response = await request<ApiResponse<Ticket[]>>(url);
    return response.data || [];
  },

  getTicket: async (id: number): Promise<TicketWithDetails> => {
    const response = await request<ApiResponse<TicketWithDetails>>(`/tickets/${id}`);
    if (!response.data) {
      throw new Error('工单不存在');
    }
    return response.data;
  },

  getMetadata: async (): Promise<Metadata> => {
    const response = await request<ApiResponse<Metadata>>('/tickets/metadata');
    if (!response.data) {
      throw new Error('获取元数据失败');
    }
    return response.data;
  },

  createTicket: async (data: CreateTicketRequest): Promise<Ticket> => {
    const response = await request<ApiResponse<Ticket>>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.data) {
      throw new Error('创建失败');
    }
    return response.data;
  },

  updateTicket: async (id: number, data: UpdateTicketRequest): Promise<void> => {
    await request<ApiResponse>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateStatus: async (id: number, data: UpdateStatusRequest): Promise<void> => {
    await request<ApiResponse>(`/tickets/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getComments: async (ticketId: number): Promise<Comment[]> => {
    const response = await request<ApiResponse<Comment[]>>(`/tickets/${ticketId}/comments`);
    return response.data || [];
  },

  addComment: async (ticketId: number, data: CreateCommentRequest): Promise<Comment> => {
    const response = await request<ApiResponse<Comment>>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.data) {
      throw new Error('添加评论失败');
    }
    return response.data;
  },

  importCSV: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/tickets/import`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '导入失败');
    }

    return data.data;
  },

  exportCSV: async (filters?: FilterParams): Promise<void> => {
    const response = await fetch(`${API_BASE}/tickets/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters || {}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '导出失败');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};
