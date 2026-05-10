import axios from 'axios';
import type {
  Nanny,
  Customer,
  Order,
  OrderDetail,
  Leave,
  Replacement,
  Evaluation,
  Settlement,
  CalendarData
} from './types';

const API_BASE = '/api';

export const api = {
  nannies: {
    getAll: () => axios.get<Nanny[]>(`${API_BASE}/nannies`),
    getAvailable: (startDate: string, endDate: string) =>
      axios.get<Nanny[]>(`${API_BASE}/nannies/available`, { params: { startDate, endDate } }),
    create: (data: Partial<Nanny>) => axios.post<Nanny>(`${API_BASE}/nannies`, data),
  },

  customers: {
    getAll: () => axios.get<Customer[]>(`${API_BASE}/customers`),
    create: (data: Partial<Customer>) => axios.post<Customer>(`${API_BASE}/customers`, data),
  },

  orders: {
    getAll: () => axios.get<Order[]>(`${API_BASE}/orders`),
    getDetail: (id: number) => axios.get<OrderDetail>(`${API_BASE}/orders/${id}`),
    create: (data: { customerId: number; nannyId: number; startDate: string; endDate: string; deposit: number }) =>
      axios.post<Order>(`${API_BASE}/orders`, data),
    updateStatus: (id: number, status: Order['status']) =>
      axios.patch<Order>(`${API_BASE}/orders/${id}/status`, { status }),
  },

  leaves: {
    create: (data: { orderId: number; nannyId: number; startDate: string; endDate: string; reason: string }) =>
      axios.post<Leave>(`${API_BASE}/leaves`, data),
    approve: (id: number) => axios.patch<Leave>(`${API_BASE}/leaves/${id}/approve`),
  },

  replacements: {
    create: (data: {
      leaveId: number;
      orderId: number;
      originalNannyId: number;
      replacementNannyId: number;
      startDate: string;
      endDate: string;
    }) => axios.post<Replacement>(`${API_BASE}/replacements`, data),
  },

  evaluations: {
    create: (data: {
      orderId: number;
      nannyId: number;
      rating: number;
      comment: string;
      deductionAmount: number;
      deductionReason: string;
    }) => axios.post<Evaluation>(`${API_BASE}/evaluations`, data),
  },

  settlement: {
    get: (orderId: number) => axios.get<Settlement>(`${API_BASE}/orders/${orderId}/settlement`),
    export: (orderId: number) =>
      axios.get(`${API_BASE}/orders/${orderId}/settlement/export`, {
        responseType: 'blob',
      }),
  },

  calendar: {
    get: (year?: number, month?: number) =>
      axios.get<CalendarData>(`${API_BASE}/calendar`, { params: { year, month } }),
  },
};
