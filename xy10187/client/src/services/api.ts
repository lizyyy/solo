import axios from 'axios';
import { ApiResponse, Employee, Merchant, Receipt, ReceiptDetail, Settlement, SettlementDetail, Appeal, StatsOverview, DuplicateGroup, Pagination } from '../types';
import { buildQueryString, downloadFile } from '../utils';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export async function getHealth() {
  const response = await api.get('/health');
  return response.data;
}

export async function getEmployees(params?: { department?: string; name?: string }) {
  const response = await api.get<ApiResponse<Employee[]>>(`/employees${buildQueryString(params || {})}`);
  return response.data;
}

export async function getEmployeeDetail(id: string) {
  const response = await api.get<ApiResponse<any>>(`/employees/${id}`);
  return response.data;
}

export async function getMerchants(params?: { name?: string }) {
  const response = await api.get<ApiResponse<Merchant[]>>(`/merchants${buildQueryString(params || {})}`);
  return response.data;
}

export async function getReceipts(params: {
  employee_id?: string;
  merchant_id?: string;
  status?: string;
  receipt_no?: string;
  start_date?: string;
  end_date?: string;
  is_duplicate?: boolean;
  page?: number;
  page_size?: number;
}) {
  const response = await api.get<ApiResponse<Receipt[]>>(`/receipts${buildQueryString(params)}`);
  return response.data;
}

export async function getReceiptDetail(id: string) {
  const response = await api.get<ApiResponse<ReceiptDetail>>(`/receipts/${id}`);
  return response.data;
}

export async function createReceipt(data: {
  employee_id: string;
  merchant_id: string;
  receipt_no: string;
  amount: number;
  consumption_date: string;
  notes?: string;
}) {
  const response = await api.post<ApiResponse<any>>('/receipts', data);
  return response.data;
}

export async function updateReceiptStatus(id: string, data: {
  status: string;
  operator?: string;
  reason?: string;
}) {
  const response = await api.put<ApiResponse<any>>(`/receipts/${id}/status`, data);
  return response.data;
}

export async function updateReceipt(id: string, data: { notes?: string }) {
  const response = await api.put<ApiResponse<any>>(`/receipts/${id}`, data);
  return response.data;
}

export async function getSettlements(params: {
  merchant_id?: string;
  status?: string;
  settlement_month?: string;
  page?: number;
  page_size?: number;
}) {
  const response = await api.get<ApiResponse<Settlement[]>>(`/settlements${buildQueryString(params)}`);
  return response.data;
}

export async function getSettlementDetail(id: string) {
  const response = await api.get<ApiResponse<SettlementDetail>>(`/settlements/${id}`);
  return response.data;
}

export async function generateSettlement(data: {
  merchant_id: string;
  settlement_month: string;
}) {
  const response = await api.post<ApiResponse<any>>('/settlements/generate', data);
  return response.data;
}

export async function updateSettlementStatus(id: string, data: {
  status: string;
  operator?: string;
}) {
  const response = await api.put<ApiResponse<any>>(`/settlements/${id}/status`, data);
  return response.data;
}

export async function getAppeals(params: {
  status?: string;
  receipt_id?: string;
  appellant?: string;
  page?: number;
  page_size?: number;
}) {
  const response = await api.get<ApiResponse<Appeal[]>>(`/appeals${buildQueryString(params)}`);
  return response.data;
}

export async function getAppealDetail(id: string) {
  const response = await api.get<ApiResponse<any>>(`/appeals/${id}`);
  return response.data;
}

export async function createAppeal(data: {
  receipt_id: string;
  appellant: string;
  appeal_type: string;
  reason: string;
}) {
  const response = await api.post<ApiResponse<any>>('/appeals', data);
  return response.data;
}

export async function handleAppeal(id: string, data: {
  status: string;
  handler?: string;
  handle_result?: string;
  approve?: boolean;
}) {
  const response = await api.put<ApiResponse<any>>(`/appeals/${id}/handle`, data);
  return response.data;
}

export async function getStatsOverview() {
  const response = await api.get<ApiResponse<StatsOverview>>('/stats/overview');
  return response.data;
}

export async function getDuplicates() {
  const response = await api.get<ApiResponse<DuplicateGroup[]>>('/stats/duplicates');
  return response.data;
}

export function exportReceipts(params: {
  employee_id?: string;
  merchant_id?: string;
  status?: string;
  receipt_no?: string;
  start_date?: string;
  end_date?: string;
  is_duplicate?: boolean;
}) {
  downloadFile(`/api/export/receipts${buildQueryString(params)}`);
}

export function exportSettlement(id: string) {
  downloadFile(`/api/export/settlements/${id}`);
}

export function exportAppeals(params: { status?: string }) {
  downloadFile(`/api/export/appeals${buildQueryString(params)}`);
}
