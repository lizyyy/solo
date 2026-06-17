import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export interface Location {
  id: number;
  name: string;
  normalizedName: string;
  address?: string;
  lat: number;
  lng: number;
  street?: string;
  district?: string;
  createdAt: string;
  updatedAt: string;
  aliases?: string[];
}

export interface ResidentFeedback {
  id: number;
  locationId: number;
  feedbackNo?: string;
  reporter?: string;
  phone?: string;
  feedbackDate: string;
  content: string;
  rawContent: string;
  source: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersion {
  id: number;
  locationId: number;
  version: string;
  title: string;
  description?: string;
  pruningType: string;
  estimatedDate?: string;
  actualDate?: string;
  contractor?: string;
  cost?: number;
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  parentVersionId?: number;
}

export interface Report {
  id: number;
  planVersionId: number;
  locationId: number;
  reportNo: string;
  title: string;
  content: string;
  pruningDetails?: string;
  issuesFound?: string;
  followUpActions?: string;
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  generatedBy: string;
  generatedAt: string;
  updatedAt: string;
}

export interface DataConflict {
  id: number;
  locationId: number;
  feedbackId?: number;
  relatedFeedbackId?: number;
  conflictType: 'location_name' | 'pruning_suggestion' | 'status' | 'content_discrepancy' | 'priority' | 'other';
  description: string;
  feedbackValue?: string;
  existingValue?: string;
  suggestedAction: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  location?: Location;
  feedback?: ResidentFeedback;
  relatedFeedback?: ResidentFeedback;
}

export interface Statistics {
  totalLocations: number;
  totalFeedbacks: number;
  pendingFeedbacks: number;
  totalPlans: number;
  draftPlans: number;
  totalReports: number;
  unresolvedConflicts: number;
  byPriority: { priority: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface LocationDetail {
  location: Location;
  aliases: string[];
  feedbacks: ResidentFeedback[];
  plans: PlanVersion[];
  reports: Report[];
  conflicts: DataConflict[];
  timeline: TimelineItem[];
}

export interface TimelineItem {
  id: number;
  type: 'feedback' | 'plan' | 'report';
  date: string;
  content: string;
  status: string;
  priority?: string;
  version?: string;
  reportNo?: string;
  createdAt?: string;
}

export const locationsApi = {
  getAll: () => api.get<Location[]>('/locations'),
  getById: (id: number) => api.get<LocationDetail>(`/locations/${id}`),
  create: (data: Partial<Location>) => api.post<Location>('/locations', data),
  update: (id: number, data: Partial<Location>) => api.put<Location>(`/locations/${id}`, data),
  merge: (targetId: number, sourceIds: number[]) => 
    api.post('/locations/merge', { targetId, sourceIds }),
  search: (query: string) => api.get<Location[]>(`/locations/search?q=${query}`)
};

export const feedbacksApi = {
  getAll: (filters?: { status?: string; priority?: string; locationId?: number }) => 
    api.get<ResidentFeedback[]>('/feedbacks', { params: filters }),
  getById: (id: number) => api.get<ResidentFeedback>(`/feedbacks/${id}`),
  create: (data: any) => api.post<ResidentFeedback>('/feedbacks', data),
  update: (id: number, data: Partial<ResidentFeedback>) => 
    api.put<ResidentFeedback>(`/feedbacks/${id}`, data),
  delete: (id: number) => api.delete(`/feedbacks/${id}`),
  import: (data: any[]) => api.post('/feedbacks/batch', { feedbacks: data })
};

export const plansApi = {
  getAll: (filters?: { status?: string; locationId?: number }) => 
    api.get<PlanVersion[]>('/plans', { params: filters }),
  getById: (id: number) => api.get<{ plan: PlanVersion; reports: Report[] }>(`/plans/${id}`),
  create: (data: any) => api.post<PlanVersion>('/plans', data),
  update: (id: number, data: Partial<PlanVersion>) => 
    api.put<PlanVersion>(`/plans/${id}`, data),
  generateReport: (id: number, generatedBy: string, customContent?: string) => 
    api.post<Report>(`/plans/${id}/report`, { generatedBy, customContent })
};

export const reportsApi = {
  getById: (id: number) => api.get<Report>(`/reports/${id}`),
  update: (id: number, data: Partial<Report>) => 
    api.put<Report>(`/reports/${id}`, data)
};

export const conflictsApi = {
  getAll: (resolved?: boolean) => 
    api.get<DataConflict[]>(resolved !== undefined ? `/conflicts?resolved=${resolved}` : '/conflicts'),
  getById: (id: number) => api.get<DataConflict>(`/conflicts/${id}`),
  resolve: (id: number, resolution: 'use_feedback' | 'use_existing' | 'manual', resolvedBy: string, notes?: string) => 
    api.post<DataConflict>(`/conflicts/${id}/resolve`, { resolution, resolvedBy, notes })
};

export const statisticsApi = {
  get: () => api.get<Statistics>('/dashboard/stats')
};

export const streetNotesApi = {
  getAll: () => api.get<any[]>('/street-notes'),
  create: (data: any) => api.post('/street-notes', data),
  update: (id: number, data: any) => api.put(`/street-notes/${id}`, data)
};

export const photosApi = {
  upload: (formData: FormData) => api.post('/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getByLocation: (locationId: number) => api.get<any[]>(`/photos/${locationId}`)
};

export default api;
