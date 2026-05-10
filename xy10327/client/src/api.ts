import { Booking, Room, Store, Customer, Statistics, StatusLog } from './types';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(BASE_URL + url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }
  
  return response.json();
}

export const api = {
  getStores: () => request<Store[]>('/stores'),
  getRooms: (storeId?: string) => 
    request<Room[]>(storeId ? `/rooms?storeId=${storeId}` : '/rooms'),
  
  getCustomers: () => request<Customer[]>('/customers'),
  
  getBookings: (params?: {
    storeId?: string;
    roomId?: string;
    status?: string[];
    startDate?: string;
    endDate?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    let url = '/bookings';
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return request<Booking[]>(url);
  },
  
  getBooking: (id: string) => request<Booking>(`/bookings/${id}`),
  getBookingLogs: (id: string) => request<StatusLog[]>(`/bookings/${id}/logs`),
  
  createBooking: (data: {
    storeId: string;
    roomId: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }) => request<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  checkIn: (id: string) => request<Booking>(`/bookings/${id}/checkin`, { method: 'POST' }),
  
  releaseLate: (id: string) => request<Booking>(`/bookings/${id}/release-late`, { method: 'POST' }),
  
  extend: (id: string, extendMinutes: number) => request<Booking>(`/bookings/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify({ extendMinutes })
  }),
  
  changeRoom: (id: string, newRoomId: string) => request<Booking>(`/bookings/${id}/change-room`, {
    method: 'POST',
    body: JSON.stringify({ newRoomId })
  }),
  
  complete: (id: string) => request<Booking>(`/bookings/${id}/complete`, { method: 'POST' }),
  
  cancel: (id: string, reason: string) => request<Booking>(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  
  checkAvailability: (roomId: string, startTime: string, endTime: string, excludeBookingId?: string) => {
    let url = `/rooms/${roomId}/availability?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
    if (excludeBookingId) {
      url += `&excludeBookingId=${excludeBookingId}`;
    }
    return request<{ available: boolean }>(url);
  },
  
  getStatistics: (start?: string, end?: string) => {
    let url = '/statistics';
    if (start && end) {
      url += `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    }
    return request<Statistics>(url);
  }
};
