import type {
  Setlist,
  Song,
  CreateSetlistRequest,
  UpdateSetlistRequest,
  CreateSongRequest,
  UpdateSongRequest,
  CheckReport,
  FieldTrace,
  ApiResponse,
  ValidationResult,
  Conflict,
  SongVersion,
  SetlistVersion,
} from '../../shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json() as ApiResponse<T>;

  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }

  return data.data as T;
}

export const setlistApi = {
  list: () => request<Setlist[]>('/setlists'),
  get: (id: string, includeSongs = true) =>
    request<Setlist & { songs: Song[] }>(`/setlists/${id}?includeSongs=${includeSongs}`),
  create: (data: CreateSetlistRequest) =>
    request<Setlist>('/setlists', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateSetlistRequest) =>
    request<Setlist>(`/setlists/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/setlists/${id}`, { method: 'DELETE' }),
};

export const songApi = {
  list: (setlistId: string) => request<Song[]>(`/setlists/${setlistId}/songs`),
  get: (setlistId: string, songId: string) =>
    request<Song>(`/setlists/${setlistId}/songs/${songId}`),
  create: (setlistId: string, data: CreateSongRequest) =>
    request<Song>(`/setlists/${setlistId}/songs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (setlistId: string, songId: string, data: UpdateSongRequest) =>
    request<Song>(`/setlists/${setlistId}/songs/${songId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (setlistId: string, songId: string) =>
    request<void>(`/setlists/${setlistId}/songs/${songId}`, { method: 'DELETE' }),
};

export const validationApi = {
  validate: (setlistId: string, generatedBy = 'system') =>
    request<{
      validations: ValidationResult[];
      conflicts: Conflict[];
      summary: {
        total: number;
        passed: number;
        errors: number;
        warnings: number;
        byType: Record<string, number>;
      };
    }>(`/setlists/${setlistId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ generatedBy }),
    }),
  validateKey: (key: string) =>
    request<{ passed: boolean; message: string; suggestion?: string }>(
      `/setlists/validate/key?key=${encodeURIComponent(key)}`
    ),
};

export const reportApi = {
  generate: (setlistId: string, generatedBy = 'system') =>
    request<CheckReport>(`/setlists/${setlistId}/report`, {
      method: 'POST',
      body: JSON.stringify({ generatedBy }),
    }),
  get: (setlistId: string) => request<CheckReport>(`/setlists/${setlistId}/report`),
  history: (setlistId: string) => request<CheckReport[]>(`/setlists/${setlistId}/report/history`),
  export: (setlistId: string, format: 'json' | 'csv' = 'json') =>
    fetch(`${API_BASE}/setlists/${setlistId}/report/export?format=${format}`),
};

export const versionApi = {
  getSetlistVersions: (setlistId: string) =>
    request<{
      setlistVersions: SetlistVersion[];
      songVersions: SongVersion[];
      currentVersion: number;
    }>(`/setlists/${setlistId}/versions`),
  getSongVersions: (setlistId: string, songId: string) =>
    request<SongVersion[]>(`/setlists/${setlistId}/versions/songs/${songId}`),
  getSongFieldVersions: (setlistId: string, songId: string, field: string) =>
    request<SongVersion[]>(
      `/setlists/${setlistId}/versions/songs/${songId}/fields/${field}`
    ),
};

export const traceApi = {
  traceField: (setlistId: string, field: string) =>
    request<FieldTrace>(`/setlists/${setlistId}/trace?field=${encodeURIComponent(field)}`),
  traceSongField: (setlistId: string, songId: string, field: string) =>
    request<FieldTrace>(
      `/setlists/${setlistId}/trace/songs/${songId}?field=${encodeURIComponent(field)}`
    ),
  getBreakdown: (setlistId: string, field: string) =>
    request<{
      rule: string;
      components: Array<{ label: string; value: number; explanation: string }>;
    }>(`/setlists/${setlistId}/trace/breakdown?field=${encodeURIComponent(field)}`),
};

export const curlExamples = [
  {
    name: '获取歌单列表',
    method: 'GET',
    path: '/api/setlists',
    curl: `curl -X GET http://localhost:3001/api/setlists`,
    description: '获取所有巡演歌单的概览信息',
  },
  {
    name: '创建新歌单',
    method: 'POST',
    path: '/api/setlists',
    curl: `curl -X POST http://localhost:3001/api/setlists \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "tourName": "夏日狂热巡演",\n    "venue": "北京工人体育馆",\n    "date": "2026-06-15",\n    "maxDuration": 7200\n  }'`,
    description: '创建一个新的巡演歌单',
  },
  {
    name: '获取歌单详情（含歌曲）',
    method: 'GET',
    path: '/api/setlists/:id',
    curl: `curl -X GET http://localhost:3001/api/setlists/sl-001?includeSongs=true`,
    description: '获取单个歌单的详细信息，包括所有歌曲',
  },
  {
    name: '增量更新歌单',
    method: 'PATCH',
    path: '/api/setlists/:id',
    curl: `curl -X PATCH http://localhost:3001/api/setlists/sl-001 \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "maxDuration": 7500,\n    "updatedBy": "巡演经理",\n    "updateReason": "延长演出时间"\n  }'`,
    description: '增量更新歌单信息，只更新提供的字段，不覆盖已有数据',
  },
  {
    name: '添加歌曲到歌单',
    method: 'POST',
    path: '/api/setlists/:setlistId/songs',
    curl: `curl -X POST http://localhost:3001/api/setlists/sl-001/songs \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "光辉岁月",\n    "originalKey": "E",\n    "currentKey": "D",\n    "duration": 295,\n    "vocalRange": {"min": "G3", "max": "E5"},\n    "instrumentTunings": {"guitar": "Drop D"},\n    "updatedBy": "音乐总监",\n    "updateReason": "新增曲目"\n  }'`,
    description: '向指定歌单添加一首新歌曲',
  },
  {
    name: '增量更新歌曲信息',
    method: 'PATCH',
    path: '/api/setlists/:setlistId/songs/:songId',
    curl: `curl -X PATCH http://localhost:3001/api/setlists/sl-001/songs/s-003 \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "currentKey": "D",\n    "vocalNotes": "主唱副歌需要降调",\n    "updatedBy": "音乐总监",\n    "updateReason": "修正调号，适配主唱嗓况"\n  }'`,
    description: '增量更新歌曲信息，系统自动记录版本历史，不覆盖已有字段',
  },
  {
    name: '执行转调检查',
    method: 'POST',
    path: '/api/setlists/:setlistId/validate',
    curl: `curl -X POST http://localhost:3001/api/setlists/sl-001/validate \\\n  -H "Content-Type: application/json" \\\n  -d '{"generatedBy": "音乐总监"}'`,
    description: '对歌单执行完整的转调校验，包括调号格式、主唱音域、乐器调弦、时长限制',
  },
  {
    name: '生成检查报告',
    method: 'POST',
    path: '/api/setlists/:setlistId/report',
    curl: `curl -X POST http://localhost:3001/api/setlists/sl-001/report \\\n  -H "Content-Type: application/json" \\\n  -d '{"generatedBy": "巡演经理"}'`,
    description: '生成完整的检查报告，包含所有校验结果、冲突详情和统计摘要',
  },
  {
    name: '获取最新检查报告',
    method: 'GET',
    path: '/api/setlists/:setlistId/report',
    curl: `curl -X GET http://localhost:3001/api/setlists/sl-001/report`,
    description: '获取歌单的最新检查报告',
  },
  {
    name: '导出报告（JSON格式）',
    method: 'GET',
    path: '/api/setlists/:setlistId/report/export',
    curl: `curl -X GET http://localhost:3001/api/setlists/sl-001/report/export?format=json \\\n  -o report.json`,
    description: '导出检查报告，支持 json 和 csv 两种格式',
  },
  {
    name: '获取版本历史',
    method: 'GET',
    path: '/api/setlists/:setlistId/versions',
    curl: `curl -X GET http://localhost:3001/api/setlists/sl-001/versions`,
    description: '获取歌单的完整版本历史，包括歌单级别和歌曲级别的所有变更',
  },
  {
    name: '数据字段追溯',
    method: 'GET',
    path: '/api/setlists/:setlistId/trace',
    curl: `curl -X GET "http://localhost:3001/api/setlists/sl-001/trace?field=totalDuration"`,
    description: '追溯指定字段的计算来源和变更历史，支持 totalDuration、songCount、maxDuration 等',
  },
  {
    name: '获取计算分解',
    method: 'GET',
    path: '/api/setlists/:setlistId/trace/breakdown',
    curl: `curl -X GET "http://localhost:3001/api/setlists/sl-001/trace/breakdown?field=totalDuration"`,
    description: '获取计算字段的详细分解过程，例如总时长是由哪些歌曲时长累加而成',
  },
  {
    name: '单字段调号校验',
    method: 'GET',
    path: '/api/setlists/validate/key',
    curl: `curl -X GET "http://localhost:3001/api/setlists/validate/key?key=H%23"`,
    description: '校验单个调号是否正确，系统会自动给出修正建议',
  },
];

export default {
  setlistApi,
  songApi,
  validationApi,
  reportApi,
  versionApi,
  traceApi,
};
