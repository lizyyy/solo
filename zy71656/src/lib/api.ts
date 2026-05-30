import type {
  ApiResponse,
  Author,
  Book,
  SalesRecord,
  ReturnRecord,
  Contract,
  RoyaltyLadder,
  DiscountActivity,
  Settlement,
  AuditLog,
  CalculateRoyaltyRequest,
  CalculateRoyaltyResponse,
  ExportRequest,
  ExportResponse,
  DashboardData,
  SettlementDetail,
} from '../../shared/types.js';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success) {
    throw new Error(data.message || 'Request failed');
  }

  return data.data as T;
}

export const api = {
  getDashboard: () => request<DashboardData>('/dashboard'),
  getAuthors: () => request<Author[]>('/authors'),
  getBooks: () => request<Book[]>('/books'),
  getSales: (period?: string) => request<SalesRecord[]>(period ? `/sales?period=${period}` : '/sales'),
  getReturns: (period?: string) => request<ReturnRecord[]>(period ? `/returns?period=${period}` : '/returns'),
  getContracts: () => request<Contract[]>('/contracts'),
  getLadders: () => request<RoyaltyLadder[]>('/ladders'),
  getDiscounts: () => request<DiscountActivity[]>('/discounts'),
  getSettlements: () => request<Settlement[]>('/settlements'),
  getSettlement: (id: string) => request<SettlementDetail>(`/settlement/${id}`),
  getAuditLogs: (settlementId?: string) =>
    request<AuditLog[]>(settlementId ? `/audit?settlementId=${settlementId}` : '/audit'),
  calculateRoyalties: (req: CalculateRoyaltyRequest) =>
    request<CalculateRoyaltyResponse>('/calculate', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  confirmException: (id: string, operator: string, note?: string) =>
    request<null>(`/exception/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ operator, note }),
    }),
  lockSettlement: (id: string, operator: string) =>
    request<null>(`/settlement/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ operator }),
    }),
  exportSettlement: (req: ExportRequest) =>
    request<ExportResponse>('/export', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
};
