import { request } from '@/utils/request';
import type { User, Store, Product, Inventory, InventoryRecord, TransferOrder, AuditLog, PaginationData } from '@/types';

export const authApi = {
  login(username: string, password: string) {
    return request.post('/auth/login', { username, password });
  },

  register(data: any) {
    return request.post('/auth/register', data);
  },

  getProfile() {
    return request.get<User>('/auth/profile');
  },
};

export const storeApi = {
  list(params?: {
    keyword?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return request.get<{ stores: Store[]; total: number }>('/stores', { params });
  },

  detail(id: string) {
    return request.get<Store>(`/stores/${id}`);
  },

  create(data: Partial<Store>) {
    return request.post<Store>('/stores', data);
  },

  update(id: string, data: Partial<Store>) {
    return request.put<Store>(`/stores/${id}`, data);
  },

  toggle(id: string) {
    return request.put<Store>(`/stores/${id}/toggle`);
  },

  delete(id: string) {
    return request.delete(`/stores/${id}`);
  },
};

export const productApi = {
  list(params?: {
    keyword?: string;
    category?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return request.get<{ products: Product[]; total: number }>('/products', { params });
  },

  detail(id: string) {
    return request.get<Product>(`/products/${id}`);
  },

  getBySku(sku: string) {
    return request.get<Product>(`/products/sku/${sku}`);
  },

  getCategories() {
    return request.get<string[]>('/products/categories');
  },

  create(data: Partial<Product>) {
    return request.post<Product>('/products', data);
  },

  update(id: string, data: Partial<Product>) {
    return request.put<Product>(`/products/${id}`, data);
  },

  toggle(id: string) {
    return request.put<Product>(`/products/${id}/toggle`);
  },

  delete(id: string) {
    return request.delete(`/products/${id}`);
  },
};

export const inventoryApi = {
  list(params?: {
    storeId?: string;
    productId?: string;
    keyword?: string;
    lowStock?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return request.get<{ inventories: (Inventory & { product: Product; store: Store })[]; total: number }>(
      '/inventory',
      { params }
    );
  },

  detail(storeId: string, productId: string) {
    return request.get<Inventory>(`/inventory/${storeId}/${productId}`);
  },

  adjust(data: {
    storeId: string;
    productId: string;
    quantity: number;
    price?: number;
    remark?: string;
  }) {
    return request.post('/inventory/adjust', data);
  },

  batchAdjust(operations: any[]) {
    return request.post('/inventory/batch-adjust', { operations });
  },

  changePrice(data: {
    storeId: string;
    productId: string;
    newPrice: number;
    reason: string;
    remark?: string;
  }) {
    return request.post('/inventory/change-price', data);
  },

  getRecords(params?: {
    inventoryId?: string;
    storeId?: string;
    productId?: string;
    operationType?: string;
    operatorId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
    offset?: number;
  }) {
    return request.get<{ records: InventoryRecord[]; total: number }>('/inventory/records', { params });
  },

  getStatistics(storeId?: string) {
    return request.get('/inventory/statistics', { params: { storeId } });
  },

  createTransfer(data: {
    sourceStoreId: string;
    targetStoreId: string;
    items: { productId: string; quantity: number; price: number }[];
    remark?: string;
  }) {
    return request.post<TransferOrder>('/inventory/transfers', data);
  },

  getTransfers(params?: {
    orderNo?: string;
    sourceStoreId?: string;
    targetStoreId?: string;
    status?: string;
    operatorId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
    offset?: number;
  }) {
    return request.get<{ orders: TransferOrder[]; total: number }>('/inventory/transfers', { params });
  },

  getTransferDetail(id: string) {
    return request.get<TransferOrder>(`/inventory/transfers/${id}`);
  },

  completeTransfer(id: string) {
    return request.put<TransferOrder>(`/inventory/transfers/${id}/complete`);
  },

  cancelTransfer(id: string) {
    return request.put<TransferOrder>(`/inventory/transfers/${id}/cancel`);
  },
};

export const auditApi = {
  list(params?: {
    operation?: string;
    entity?: string;
    entityId?: string;
    userId?: string;
    startTime?: string;
    endTime?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }) {
    return request.get<{ logs: AuditLog[]; total: number }>('/audit', { params });
  },

  detail(id: string) {
    return request.get<AuditLog>(`/audit/${id}`);
  },

  getByRequestId(requestId: string) {
    return request.get<AuditLog[]>(`/audit/request/${requestId}`);
  },

  getByEntity(entity: string, entityId: string, limit?: number, offset?: number) {
    return request.get<{ logs: AuditLog[]; total: number }>(`/audit/entity/${entity}/${entityId}`, {
      params: { limit, offset },
    });
  },

  replay(id: string) {
    return request.get(`/audit/replay/${id}`);
  },

  replayRequest(requestId: string) {
    return request.get(`/audit/replay/request/${requestId}`);
  },

  getHistory(entity: string, entityId: string) {
    return request.get(`/audit/history/${entity}/${entityId}`);
  },

  getSnapshot(entity: string, entityId: string, timestamp: string) {
    return request.get(`/audit/snapshot/${entity}/${entityId}`, { params: { timestamp } });
  },

  getSummary(entity: string, entityId: string, startDate: string, endDate: string) {
    return request.get(`/audit/summary/${entity}/${entityId}`, {
      params: { startDate, endDate },
    });
  },
};

export const exportApi = {
  exportInventory(format: 'excel' | 'markdown' | 'pdf', params?: {
    storeId?: string;
    startTime?: string;
    endTime?: string;
    includeRecords?: boolean;
    includeTransfers?: boolean;
  }) {
    return request.download('/export/inventory', {
      format,
      ...params,
    });
  },

  exportInventoryAsync(format: 'excel' | 'markdown' | 'pdf', params?: any) {
    return request.post('/export/inventory/async', {
      format,
      ...params,
    });
  },

  getTasks(limit?: number, offset?: number) {
    return request.get('/export/tasks', { params: { limit, offset } });
  },

  getTaskStatus(taskId: string) {
    return request.get(`/export/tasks/${taskId}`);
  },
};
