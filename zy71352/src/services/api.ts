import type {
  Artwork,
  ArtworkDetail,
  Valuation,
  LoanContract,
  TransportNode,
  InsuranceClause,
  ChangeLog,
  GapAlert,
  ReportSummary,
  RecordStatus,
  Currency,
  ApiResponse,
} from '../../shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return {
    success: response.ok,
    data: (await response.arrayBuffer()) as unknown as T,
  } as ApiResponse<T>;
}

export const artworkApi = {
  getList: (params?: {
    status?: RecordStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());

    return request<{ artworks: Artwork[]; total: number }>(
      `/artworks${query.toString() ? `?${query.toString()}` : ''}`
    );
  },

  getDetail: (id: string) => {
    return request<ArtworkDetail>(`/artworks/${id}`);
  },

  create: (data: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    return request<Artwork>('/artworks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (
    id: string,
    data: Partial<Omit<Artwork, 'id' | 'createdAt'>> & { operator?: string }
  ) => {
    return request<Artwork>(`/artworks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateStatus: (
    id: string,
    status: RecordStatus,
    reason?: string,
    operator?: string
  ) => {
    return request<Artwork>(`/artworks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason, operator }),
    });
  },

  getChangeLogs: (id: string) => {
    return request<ChangeLog[]>(`/artworks/${id}/changelog`);
  },
};

export const valuationApi = {
  upsert: (data: Omit<Valuation, 'id' | 'createdAt'> & { operator?: string }) => {
    return request<Valuation>('/valuations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const contractApi = {
  addVersion: (
    data: Omit<LoanContract, 'id' | 'createdAt' | 'isLatest'> & { operator?: string }
  ) => {
    return request<LoanContract>('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  compareVersions: (id: string) => {
    return request<{
      current: LoanContract;
      previous: LoanContract | null;
      allVersions: LoanContract[];
      differences: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
    }>(`/contracts/${id}/compare`);
  },
};

export const transportApi = {
  upsertNode: (
    data: Omit<TransportNode, 'id'> & { operator?: string }
  ) => {
    return request<TransportNode>('/transport-nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateStatus: (
    id: string,
    status: TransportNode['status'],
    timestamp?: string,
    operator?: string
  ) => {
    return request<TransportNode>(`/transport-nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, timestamp, operator }),
    });
  },
};

export const insuranceApi = {
  upsert: (
    data: Omit<InsuranceClause, 'id' | 'createdAt'> & { operator?: string }
  ) => {
    return request<InsuranceClause>('/insurance-clauses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const gapCheckApi = {
  checkArtwork: (artworkId: string) => {
    return request<{ alerts: GapAlert[]; isComplete: boolean }>(
      `/gap-check/${artworkId}`
    );
  },

  checkBatch: (artworkIds?: string[]) => {
    const query = artworkIds ? `?artworkIds=${artworkIds.join(',')}` : '';
    return request<{ alerts: GapAlert[]; isComplete: boolean }[]>(
      `/gap-check${query}`
    );
  },

  resolveAlert: (alertId: string) => {
    return request<GapAlert>(`/gap-check/alerts/${alertId}/resolve`, {
      method: 'PATCH',
    });
  },
};

export const reportApi = {
  getSummary: () => {
    return request<ReportSummary>('/reports/summary');
  },

  export: (format: 'xlsx' | 'pdf', status?: RecordStatus) => {
    return request<ArrayBuffer>('/reports/export', {
      method: 'POST',
      body: JSON.stringify({ format, status }),
    });
  },
};

export const currencyApi = {
  convert: (amount: number, from: Currency, to?: Currency) => {
    const query = new URLSearchParams({
      amount: amount.toString(),
      from,
      ...(to && { to }),
    });
    return request<{
      originalAmount: number;
      originalCurrency: Currency;
      convertedAmount: number;
      targetCurrency: Currency;
    }>(`/currency/convert?${query.toString()}`);
  },

  getRates: () => {
    return request<Record<Currency, number>>('/currency/rates');
  },

  updateRate: (currency: Currency, rate: number) => {
    return request<Record<Currency, number>>(`/currency/rates/${currency}`, {
      method: 'PATCH',
      body: JSON.stringify({ rate }),
    });
  },
};

export default {
  artwork: artworkApi,
  valuation: valuationApi,
  contract: contractApi,
  transport: transportApi,
  insurance: insuranceApi,
  gapCheck: gapCheckApi,
  report: reportApi,
  currency: currencyApi,
};
