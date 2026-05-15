import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Reservation {
  reservation_id: string;
  order_id: string;
  pool_id: string;
  quantity: number;
  status: string;
  expire_at: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryPool {
  pool_id: string;
  pool_name: string;
  total_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Statistics {
  totalReservations: number;
  statusStats: Record<string, number>;
  failedTasks: number;
  pendingCompensation: number;
  inventoryStats: InventoryPool[];
}

export interface ReleaseRecord {
  record_id: string;
  reservation_id: string;
  order_id: string;
  pool_id: string;
  quantity: number;
  release_type: string;
  release_reason: string;
  released_by: string;
  created_at: string;
}

export interface CompensationAction {
  action_id: string;
  reservation_id: string;
  action_type: string;
  action_status: string;
  executed_by: string;
  error_message?: string;
  created_at: string;
  executed_at?: string;
}

export interface InventoryLog {
  log_id: string;
  pool_id: string;
  reservation_id?: string;
  order_id?: string;
  change_type: string;
  quantity_change: number;
  before_total: number;
  after_total: number;
  before_reserved: number;
  after_reserved: number;
  operator: string;
  created_at: string;
}

export const reservationApi = {
  create: (data: { orderId: string; poolId: string; quantity: number; expireSeconds?: number }) =>
    api.post<Reservation>('/reservations', data),
  list: (status?: string) => api.get<Reservation[]>('/reservations', { params: { status } }),
  get: (id: string) => api.get<Reservation>(`/reservations/${id}`),
  getByOrder: (orderId: string) => api.get<Reservation[]>(`/reservations/order/${orderId}`),
  confirm: (id: string) => api.post<Reservation>(`/reservations/${id}/confirm`),
  release: (id: string, data: { releaseType?: string; reason?: string; releasedBy?: string }) =>
    api.post<Reservation>(`/reservations/${id}/release`, data),
  compensate: (id: string, data: { operator?: string }) =>
    api.post(`/reservations/${id}/compensate`, data),
  exportCsv: (status?: string) =>
    api.get(`/reservations/export/csv`, { params: { status }, responseType: 'blob' }),
};

export const inventoryApi = {
  createPool: (data: { poolName: string; initialQuantity?: number }) =>
    api.post<InventoryPool>('/inventory/pool', data),
  listPools: () => api.get<InventoryPool[]>('/inventory/pool'),
  getPool: (id: string) => api.get<InventoryPool>(`/inventory/pool/${id}`),
  getLogs: (params?: { poolId?: string; orderId?: string; limit?: number }) =>
    api.get<InventoryLog[]>('/inventory/logs', { params }),
};

export const adminApi = {
  getStats: () => api.get<Statistics>('/admin/stats'),
  getFailedReleases: () => api.get<any[]>('/admin/failed-releases'),
  getReleaseRecords: (reservationId?: string) =>
    api.get<ReleaseRecord[]>('/admin/release-records', { params: { reservationId } }),
  getCompensationActions: (status?: string) =>
    api.get<CompensationAction[]>('/admin/compensation-actions', { params: { status } }),
  processTimeouts: () => api.post<{ processed: number }>('/admin/process-timeouts'),
};

export default api;