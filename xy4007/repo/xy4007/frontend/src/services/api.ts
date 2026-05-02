import type {
  Order,
  Technician,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderStatus
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(errorData.error || '请求失败');
  }
  return response.json();
}

export const orderApi = {
  getOrders: async (params?: {
    date?: string;
    technician_id?: number;
    status?: OrderStatus;
  }): Promise<Order[]> => {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.technician_id) searchParams.set('technician_id', params.technician_id.toString());
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    const url = query ? `${API_BASE}/orders?${query}` : `${API_BASE}/orders`;
    const response = await fetch(url);
    return handleResponse<Order[]>(response);
  },

  getOrderById: async (id: number): Promise<Order> => {
    const response = await fetch(`${API_BASE}/orders/${id}`);
    return handleResponse<Order>(response);
  },

  createOrder: async (data: CreateOrderRequest): Promise<{ id: number; message: string }> => {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  updateOrder: async (id: number, data: UpdateOrderRequest): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  updateStatus: async (id: number, status: OrderStatus, note?: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note })
    });
    return handleResponse(response);
  },

  addNote: async (id: number, content: string): Promise<{ id: number; message: string }> => {
    const response = await fetch(`${API_BASE}/orders/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    return handleResponse(response);
  }
};

export const technicianApi = {
  getAll: async (): Promise<Technician[]> => {
    const response = await fetch(`${API_BASE}/technicians`);
    return handleResponse<Technician[]>(response);
  },

  create: async (name: string, phone?: string): Promise<{ id: number; message: string }> => {
    const response = await fetch(`${API_BASE}/technicians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    });
    return handleResponse(response);
  }
};

export const csvApi = {
  exportToday: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/csv/export/today`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '导出失败' }));
      throw new Error(errorData.error || '导出失败');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().split('T')[0];
    a.download = `工单_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  import: async (file: File): Promise<{
    message: string;
    successCount: number;
    errors?: string[];
  }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/csv/import`, {
      method: 'POST',
      body: formData
    });

    return handleResponse(response);
  }
};
