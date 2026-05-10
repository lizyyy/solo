import { 
  Rider, Checkpoint, Checkin, DashboardStats, RiderDetails,
  EquipmentCheck, Dropout, Supply, FinishRecord, ApprovalComment, EquipmentItem
} from './types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  });
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '请求失败');
  }
  
  return response.json();
}

export const api = {
  getCheckpoints: () => request<Checkpoint[]>('/checkpoints'),
  addCheckpoint: (data: Omit<Checkpoint, 'id'>) => request<Checkpoint>('/checkpoints', {
    method: 'POST', body: JSON.stringify(data)
  }),
  
  getRiders: (status?: string) => request<Rider[]>(status ? `/riders?status=${status}` : '/riders'),
  getRiderByBib: (bib: number) => request<Rider>(`/riders/bib/${bib}`),
  getRiderDetails: (id: string) => request<RiderDetails>(`/riders/${id}`),
  registerRider: (data: Omit<Rider, 'id' | 'status' | 'registeredAt'>) => request<Rider>('/riders', {
    method: 'POST', body: JSON.stringify(data)
  }),
  
  recordEquipmentCheck: (data: {
    riderId: string;
    items: EquipmentItem[];
    overallResult: 'passed' | 'failed';
    checkerName: string;
    comments?: string;
  }) => request<EquipmentCheck>('/equipment-checks', {
    method: 'POST', body: JSON.stringify(data)
  }),
  
  recordCheckin: (data: { riderId: string; checkpointId: string; checkedBy: string }) => 
    request<Checkin>('/checkins', { method: 'POST', body: JSON.stringify(data) }),
  getCheckins: (checkpointId?: string, riderId?: string) => {
    const params = new URLSearchParams();
    if (checkpointId) params.append('checkpointId', checkpointId);
    if (riderId) params.append('riderId', riderId);
    const qs = params.toString();
    return request<Checkin[]>(qs ? `/checkins?${qs}` : '/checkins');
  },
  
  recordDropout: (data: {
    riderId: string;
    checkpointId?: string;
    reason: string;
    comments?: string;
    recordedBy: string;
  }) => request<Dropout>('/dropouts', { method: 'POST', body: JSON.stringify(data) }),
  getDropouts: () => request<Dropout[]>('/dropouts'),
  
  recordSupply: (data: {
    riderId: string;
    supplyType: 'course' | 'finish';
    checkpointId?: string;
    collectedBy: string;
  }) => request<Supply>('/supplies', { method: 'POST', body: JSON.stringify(data) }),
  getSupplies: (riderId?: string) => 
    request<Supply[]>(riderId ? `/supplies?riderId=${riderId}` : '/supplies'),
  
  recordFinish: (data: { riderId: string; recordedBy: string }) => 
    request<FinishRecord>('/finish', { method: 'POST', body: JSON.stringify(data) }),
  getFinishRecords: () => request<FinishRecord[]>('/finish-records'),
  
  addApproval: (data: Omit<ApprovalComment, 'id' | 'madeAt'>) => 
    request<ApprovalComment>('/approvals', { method: 'POST', body: JSON.stringify(data) }),
  getApprovals: (relatedType?: string, relatedId?: string) => {
    const params = new URLSearchParams();
    if (relatedType) params.append('relatedType', relatedType);
    if (relatedId) params.append('relatedId', relatedId);
    const qs = params.toString();
    return request<ApprovalComment[]>(qs ? `/approvals?${qs}` : '/approvals');
  },
  
  getDashboard: () => request<DashboardStats>('/dashboard'),
  
  exportReport: () => fetch(`${API_BASE}/export`).then(res => res.blob())
};

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}小时${m}分${s}秒`;
}
