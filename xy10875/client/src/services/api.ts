import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export interface Invoice {
  id: string;
  invoice_no?: string;
  invoice_code?: string;
  invoice_date?: string;
  amount?: number;
  tax_amount?: number;
  total_amount?: number;
  seller_name?: string;
  category?: string;
  status: string;
  employee_id?: string;
  employee_name?: string;
  department?: string;
  created_at: string;
}

export interface MatchResult {
  id: string;
  invoice_id: string;
  trip_id?: string;
  budget_category_id?: string;
  match_type?: string;
  match_score?: number;
  status: string;
  matched_by?: string;
  matched_at?: string;
  notes?: string;
  departure_city?: string;
  arrival_city?: string;
  start_date?: string;
  end_date?: string;
  budget_name?: string;
  budget_code?: string;
}

export interface DuplicateInvoice {
  id: string;
  original_invoice_id: string;
  duplicate_invoice_id: string;
  duplicate_type?: string;
  confidence?: number;
  status: string;
  orig_invoice_no?: string;
  orig_total_amount?: number;
  dup_invoice_no?: string;
  dup_total_amount?: number;
}

export interface StatusTimeline {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  previous_status?: string;
  operator?: string;
  notes?: string;
  created_at: string;
}

export interface Trip {
  id: string;
  employee_id: string;
  employee_name: string;
  department?: string;
  departure_city?: string;
  arrival_city?: string;
  start_date?: string;
  end_date?: string;
  purpose?: string;
  estimated_amount?: number;
  status: string;
}

export interface Budget {
  id: string;
  code: string;
  name: string;
  department?: string;
  annual_budget: number;
  used_budget: number;
  status: string;
}

export interface Statistics {
  totalInvoices: number;
  matched: number;
  pending: number;
  duplicate: number;
  confirmed: number;
  autoMatched: number;
  manualMatched: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const invoiceApi = {
  getList: (params: {
    page?: number;
    pageSize?: number;
    status?: string;
    employee_name?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get<ApiResponse<PaginatedResponse<Invoice>>>('/invoices', { params }),

  getDetail: (id: string) => api.get<ApiResponse<{
    invoice: Invoice;
    matches: MatchResult[];
    duplicates: DuplicateInvoice[];
    timeline: StatusTimeline[];
  }>>(`/invoices/${id}`),

  create: (data: Partial<Invoice>) => api.post<ApiResponse<Invoice>>('/invoices', data),

  batchImport: (invoices: Partial<Invoice>[]) => api.post<ApiResponse<any>>('/invoices/batch', { invoices }),

  manualMatch: (id: string, data: {
    trip_id?: string;
    budget_category_id?: string;
    notes?: string;
    operator?: string;
  }) => api.post<ApiResponse<MatchResult>>(`/invoices/${id}/match`, data),
};

export const matchApi = {
  confirm: (id: string, operator?: string) => api.post<ApiResponse>(`/matches/${id}/confirm`, { operator }),
};

export const duplicateApi = {
  resolve: (id: string, action: 'keep_original' | 'keep_duplicate' | 'keep_both', operator?: string) => 
    api.post<ApiResponse>(`/duplicates/${id}/resolve`, { action, operator }),
};

export const tripApi = {
  getList: () => api.get<ApiResponse<Trip[]>>('/trips'),
};

export const budgetApi = {
  getList: () => api.get<ApiResponse<Budget[]>>('/budgets'),
};

export const statisticsApi = {
  get: (params?: { start_date?: string; end_date?: string }) => 
    api.get<ApiResponse<Statistics>>('/statistics', { params }),
};

export const reportApi = {
  generate: (params?: { start_date?: string; end_date?: string }) => 
    api.post<ApiResponse<{ fileName: string }>>('/reports', params),

  download: (fileName: string) => {
    window.open(`/api/reports/${fileName}`, '_blank');
  },
};

export default api;
