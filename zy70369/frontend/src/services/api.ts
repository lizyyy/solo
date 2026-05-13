import axios from 'axios';
import type { OrderException, ExceptionDetail, Operator, ActionType } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const exceptionApi = {
  getList: (): Promise<OrderException[]> => 
    api.get('/exceptions').then(res => res.data),
  
  getDetail: (id: string): Promise<ExceptionDetail> => 
    api.get(`/exceptions/${id}`).then(res => res.data),
  
  lock: (id: string, operatorId: string) => 
    api.post(`/exceptions/${id}/lock`, { operator_id: operatorId }),
  
  unlock: (id: string, operatorId: string) => 
    api.post(`/exceptions/${id}/unlock`, { operator_id: operatorId }),
  
  executeAction: (id: string, actionType: ActionType, operatorId: string, actionData?: any, reason?: string) => 
    api.post(`/exceptions/${id}/actions`, {
      action_type: actionType,
      action_data: actionData,
      operator_id: operatorId,
      reason
    }).then(res => res.data),
  
  retryAction: (id: string, actionId: string, operatorId: string) => 
    api.post(`/exceptions/${id}/actions/${actionId}/retry`, {
      operator_id: operatorId
    }).then(res => res.data),
  
  resolve: (id: string, resolution: string, reason: string, operatorId: string) => 
    api.post(`/exceptions/${id}/resolve`, {
      resolution,
      resolution_reason: reason,
      operator_id: operatorId
    })
};

export const operatorApi = {
  getList: (): Promise<Operator[]> => 
    api.get('/exceptions/operators/list').then(res => res.data)
};

export const exportApi = {
  downloadCSV: (status?: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    window.location.href = `/api/export/arbitration/csv?${params.toString()}`;
  },
  
  getDetails: (id: string) => 
    api.get(`/export/arbitration/${id}/details`).then(res => res.data)
};
