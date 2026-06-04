import type {
  User,
  BillRecord,
  ConflictRecord,
  GapRecord,
  ParamVersion,
  OperationHistory,
  EvidenceItem,
  RecordStatus,
  ConflictResolution,
  GapReviewStatus,
} from '../../shared/types';

const BASE_URL = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

interface ImportResponse {
  success: boolean;
  importedCount: number;
  message: string;
}

interface GetRecordsParams {
  status?: RecordStatus;
  page?: number;
  pageSize?: number;
}

interface RecordsResponse {
  records: BillRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface GetHistoryFilters {
  operationType?: string;
  operator?: string;
  startDate?: string;
  endDate?: string;
  recordId?: string;
}

interface VersionComparison {
  fromVersion: string;
  toVersion: string;
  changes: Array<{
    field: string;
    from: string | number;
    to: string | number;
  }>;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

function getUserRole(): string | null {
  return localStorage.getItem('userRole');
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const role = getUserRole();
  if (role) {
    headers['x-user-role'] = role;
  }

  let body: BodyInit | null = null;

  if (options.body !== undefined && options.body !== null) {
    if (options.body instanceof FormData) {
      body = options.body;
      delete headers['Content-Type'];
    } else {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
    body,
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('网络请求失败');
  }
}

export const api = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await request<ApiResponse<LoginResponse>>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || '登录失败');
    }

    const { user, token } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userRole', user.role);

    return response.data;
  },

  async importTeacherNotes(file: File): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await request<ApiResponse<ImportResponse>>('/import/teacher-notes', {
      method: 'POST',
      body: formData,
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || '导入失败');
    }

    return response.data;
  },

  async importSamplingList(file: File): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await request<ApiResponse<ImportResponse>>('/import/sampling-list', {
      method: 'POST',
      body: formData,
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || '导入失败');
    }

    return response.data;
  },

  async getRecords(params?: GetRecordsParams): Promise<RecordsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/records?${queryString}` : '/records';

    const response = await request<ApiResponse<RecordsResponse>>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取记录失败');
    }

    return response.data;
  },

  async getRecordDetail(id: string): Promise<BillRecord> {
    const response = await request<ApiResponse<BillRecord>>(`/records/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取记录详情失败');
    }

    return response.data;
  },

  async getEvidenceChain(id: string): Promise<EvidenceItem[]> {
    const response = await request<ApiResponse<EvidenceItem[]>>(`/records/${id}/evidence`);

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取证据链失败');
    }

    return response.data;
  },

  async getConflicts(): Promise<ConflictRecord[]> {
    const response = await request<ApiResponse<ConflictRecord[]>>('/conflicts');

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取冲突列表失败');
    }

    return response.data;
  },

  async resolveConflict(
    id: string,
    resolution: ConflictResolution,
    note: string
  ): Promise<ConflictRecord> {
    const response = await request<ApiResponse<ConflictRecord>>(`/conflicts/${id}/resolve`, {
      method: 'POST',
      body: { resolution, note },
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || '解决冲突失败');
    }

    return response.data;
  },

  async getGaps(): Promise<GapRecord[]> {
    const response = await request<ApiResponse<GapRecord[]>>('/gaps');

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取断档列表失败');
    }

    return response.data;
  },

  async reviewGap(
    id: string,
    status: GapReviewStatus,
    note: string
  ): Promise<GapRecord> {
    const response = await request<ApiResponse<GapRecord>>(`/gaps/${id}/review`, {
      method: 'POST',
      body: { status, note },
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || '审核断档失败');
    }

    return response.data;
  },

  async getVersions(): Promise<ParamVersion[]> {
    const response = await request<ApiResponse<ParamVersion[]>>('/versions');

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取版本列表失败');
    }

    return response.data;
  },

  async getVersion(id: string): Promise<ParamVersion> {
    const response = await request<ApiResponse<ParamVersion>>(`/versions/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取版本详情失败');
    }

    return response.data;
  },

  async compareVersions(from: string, to: string): Promise<VersionComparison> {
    const response = await request<ApiResponse<VersionComparison>>(
      `/versions/compare?from=${from}&to=${to}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '版本比较失败');
    }

    return response.data;
  },

  async getHistory(filters?: GetHistoryFilters): Promise<OperationHistory[]> {
    const searchParams = new URLSearchParams();
    if (filters?.operationType) searchParams.append('operationType', filters.operationType);
    if (filters?.operator) searchParams.append('operator', filters.operator);
    if (filters?.startDate) searchParams.append('startDate', filters.startDate);
    if (filters?.endDate) searchParams.append('endDate', filters.endDate);
    if (filters?.recordId) searchParams.append('recordId', filters.recordId);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/history?${queryString}` : '/history';

    const response = await request<ApiResponse<OperationHistory[]>>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取操作历史失败');
    }

    return response.data;
  },
};
