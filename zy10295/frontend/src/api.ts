import axios from 'axios';
import { Tire, Vehicle, TireLifecycleDetail, VehicleAvailability, TireStatus } from './types';

const api = axios.create({
  baseURL: '/api',
});

export const tireApi = {
  getAll: (filters?: { status?: TireStatus; vehicle_id?: string }) => 
    api.get<Tire[]>('/tires', { params: filters }).then(res => res.data),
  
  getById: (id: string) => 
    api.get<Tire>(`/tires/${id}`).then(res => res.data),
  
  getLifecycle: (id: string) => 
    api.get<TireLifecycleDetail>(`/tires/${id}/lifecycle`).then(res => res.data),
  
  create: (data: { serial_number: string; brand: string; model: string; size: string }) => 
    api.post<Tire>('/tires', data).then(res => res.data),
  
  install: (id: string, data: { vehicle_id: string; performed_by?: string; notes?: string }) => 
    api.post<Tire>(`/tires/${id}/install`, data).then(res => res.data),
  
  remove: (id: string, data: { reason: string; performed_by?: string; notes?: string }) => 
    api.post<Tire>(`/tires/${id}/remove`, data).then(res => res.data),
  
  inspect: (id: string, data: { result: 'passed' | 'failed'; inspection_notes: string; cost?: number; performed_by?: string; notes?: string }) => 
    api.post<Tire>(`/tires/${id}/inspect`, data).then(res => res.data),
  
  sendToRetread: (id: string, data: { cost: number; performed_by?: string; notes?: string }) => 
    api.post<Tire>(`/tires/${id}/retread`, data).then(res => res.data),
  
  completeRetread: (id: string, data: { performed_by?: string; notes?: string }) => 
    api.post<Tire>(`/tires/${id}/complete-retread`, data).then(res => res.data),
  
  scrap: (id: string, data: { reason: string; performed_by?: string; notes?: string }) => 
    api.post<Tire>(`/tires/${id}/scrap`, data).then(res => res.data),
};

export const vehicleApi = {
  getAll: () => 
    api.get<Vehicle[]>('/vehicles').then(res => res.data),
  
  getById: (id: string) => 
    api.get<Vehicle>(`/vehicles/${id}`).then(res => res.data),
  
  getAvailability: (id: string) => 
    api.get<VehicleAvailability>(`/vehicles/${id}/availability`).then(res => res.data),
  
  getAllAvailability: () => 
    api.get<VehicleAvailability[]>('/vehicles/availability').then(res => res.data),
  
  getTires: (id: string) => 
    api.get<Tire[]>(`/vehicles/${id}/tires`).then(res => res.data),
  
  create: (data: { plate_number: string; model: string; tire_count?: number }) => 
    api.post<Vehicle>('/vehicles', data).then(res => res.data),
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const value = row[h];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};
