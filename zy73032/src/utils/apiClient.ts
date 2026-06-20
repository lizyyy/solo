import type {
  Schedule,
  MedicalRecord,
  SummaryStats,
  AnomalyItem,
  OperationLog,
  CsvImportResult,
  AliasBindResult,
} from '../types'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `请求失败: ${res.status}`)
  }
  return (await res.json()) as T
}

export const api = {
  getSummary: (): Promise<SummaryStats> => request<SummaryStats>('/summary'),

  getSchedules: (includeAnomalies = true): Promise<{ items: Schedule[] }> =>
    request<{ items: Schedule[] }>(`/schedules${includeAnomalies ? '' : '?include_anomalies=false'}`),

  confirmSchedule: (id: number, operator: string, remark = ''): Promise<Schedule> =>
    request<Schedule>(`/schedules/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ operator, remark }),
    }),

  withdrawSchedule: (id: number, operator: string, remark = ''): Promise<Schedule> =>
    request<Schedule>(`/schedules/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ operator, remark }),
    }),

  importCsv: (csvText: string, label: string): Promise<CsvImportResult> =>
    request<CsvImportResult>('/imports/schedules', {
      method: 'POST',
      body: JSON.stringify({ csv_text: csvText, label }),
    }),

  addMedicalRecord: (data: {
    pet_name: string
    visit_date: string
    diagnosis: string
    treatment: string
    veterinarian: string
    source_row?: string
  }): Promise<MedicalRecord> =>
    request<MedicalRecord>('/medical-records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAnomalies: (): Promise<{ items: AnomalyItem[] }> =>
    request<{ items: AnomalyItem[] }>('/anomalies'),

  getLogs: (): Promise<{ items: OperationLog[] }> =>
    request<{ items: OperationLog[] }>('/logs'),

  bindAlias: (aliasName: string, canonicalName: string, operator = '小乔'): Promise<AliasBindResult> =>
    request<AliasBindResult>('/aliases/bind', {
      method: 'POST',
      body: JSON.stringify({ alias_name: aliasName, canonical_name: canonicalName, operator }),
    }),

  seedDemo: (): Promise<{ seeded: boolean; summary: SummaryStats }> =>
    request<{ seeded: boolean; summary: SummaryStats }>('/seed', { method: 'POST' }),

  exportCsvUrl: (): string => '/exports/schedules.csv',
}
