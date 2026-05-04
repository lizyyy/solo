import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface TokenizeResult {
  text: string
  tokens: Array<{
    token: string
    token_id: number
    start_pos: number
    end_pos: number
    is_whitespace: boolean
  }>
  token_ids: number[]
  token_count: number
  char_count: number
  tokenizer: string
}

export interface TruncateResult {
  original_text: string
  truncated_text: string
  truncated_tokens: Array<{
    token: string
    token_id: number
    start_pos: number
    end_pos: number
  }>
  truncated_ids: number[]
  original_count: number
  max_tokens: number
  truncated: boolean
  truncation_side: string
  removed_count: number
}

export interface GenerateResult {
  input_text: string
  input_tokens: number[]
  generated_tokens: number[]
  generated_text: string
  token_probs: Array<Record<string, number>>
  latency_ms: number
  latency_per_token_ms: number[]
  using_kv_cache: boolean
  parameters: {
    max_new_tokens: number
    temperature: number
    top_p: number
    top_k: number
    sampling_type: string
  }
  risks: string[]
}

export interface AttentionHeatmapResult {
  input_token_count: number
  layers: Array<{
    layer: number
    tokens: string[]
    attention_matrix: number[][]
    max_attention: number
    min_attention: number
  }>
  num_layers: number
  num_heads: number
  token_info: TokenizeResult
}

export interface KVCacheComparisonResult {
  input_text: string
  max_new_tokens: number
  iterations: number
  with_kv_cache: {
    latencies_ms: number[]
    mean_ms: number
    std_ms: number
    min_ms: number
    max_ms: number
  }
  without_kv_cache: {
    latencies_ms: number[]
    mean_ms: number
    std_ms: number
    min_ms: number
    max_ms: number
  }
  speedup_ratio: number
  explanation: string
}

export interface SamplingComparisonResult {
  input_text: string
  max_new_tokens: number
  comparisons: Array<{
    method: string
    parameters: {
      sampling_type: string
      temperature: number
      top_p: number
      top_k: number
    }
    generated_tokens: number[]
    token_probs: Array<Record<string, number>>
    risks: string[]
    latency_ms: number
  }>
}

export interface Experiment {
  id: string
  name: string
  type: string
  created_at: string
  updated_at: string
  parameters: Record<string, any>
  results: Record<string, any>
  risks: string[]
  input_data: Record<string, any>
  notes: string
}

export interface SeedData {
  corpus: Array<{
    id: string
    text: string
    source: string
    category: string
  }>
  finetune: Array<{
    id: string
    prompt: string
    completion: string
    category: string
  }>
  inference: Array<{
    id: string
    prompt: string
    expected_output?: string
    parameters: Record<string, any>
  }>
  edge_cases: Array<{
    id: string
    text: string
    description: string
  }>
}

export const tokenizerApi = {
  tokenize: (text: string, useHf: boolean = true) =>
    api.post<{ success: boolean; data: TokenizeResult }>('/tokenizer/tokenize', {
      text,
      use_hf: useHf,
    }),

  truncate: (text: string, maxTokens: number, truncationSide: string = 'right') =>
    api.post<{ success: boolean; data: TruncateResult }>('/tokenizer/truncate', {
      text,
      max_tokens: maxTokens,
      truncation_side: truncationSide,
    }),

  getVocabSize: () =>
    api.get<{
      success: boolean
      data: { vocab_size: number; tokenizer_available: boolean }
    }>('/tokenizer/vocab-size'),
}

export const inferenceApi = {
  generate: (params: {
    text: string
    max_new_tokens?: number
    temperature?: number
    top_p?: number
    top_k?: number
    sampling_type?: string
    use_kv_cache?: boolean
  }) =>
    api.post<{ success: boolean; data: GenerateResult }>('/inference/generate', params),

  getAttentionHeatmap: (text: string) =>
    api.post<{ success: boolean; data: AttentionHeatmapResult }>(
      '/inference/attention-heatmap',
      { text }
    ),

  compareKVCache: (params: { text: string; max_new_tokens?: number; iterations?: number }) =>
    api.post<{ success: boolean; data: KVCacheComparisonResult }>(
      '/inference/kv-cache-comparison',
      params
    ),

  compareSampling: (text: string, maxNewTokens: number = 10) =>
    api.post<{ success: boolean; data: SamplingComparisonResult }>(
      `/inference/sampling-comparison?text=${encodeURIComponent(text)}&max_new_tokens=${maxNewTokens}`
    ),
}

export const experimentApi = {
  create: (params: {
    name: string
    type: string
    parameters: Record<string, any>
    results: Record<string, any>
    risks?: string[]
    input_data?: Record<string, any>
    notes?: string
  }) =>
    api.post<{ success: boolean; data: Experiment }>('/experiment/', params),

  list: (params?: { type?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.offset) searchParams.set('offset', params.offset.toString())
    return api.get<{
      success: boolean
      data: { total: number; experiments: Experiment[] }
    }>(`/experiment/?${searchParams.toString()}`)
  },

  get: (id: string) =>
    api.get<{ success: boolean; data: Experiment }>(`/experiment/${id}`),

  update: (id: string, params: Partial<Experiment>) =>
    api.put<{ success: boolean; data: Experiment }>(`/experiment/${id}`, params),

  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/experiment/${id}`),

  exportMarkdown: (id: string) =>
    api.get<string>(`/experiment/${id}/export/markdown`, {
      responseType: 'text',
    }),

  exportJson: (id: string) =>
    api.get<{ success: boolean; data: any }>(`/experiment/${id}/export/json`),
}

export const dataApi = {
  getSeedCorpus: () =>
    api.get<{ success: boolean; data: SeedData['corpus'] }>('/data/seed/corpus'),

  getSeedFinetune: () =>
    api.get<{ success: boolean; data: SeedData['finetune'] }>('/data/seed/finetune'),

  getSeedInference: () =>
    api.get<{ success: boolean; data: SeedData['inference'] }>('/data/seed/inference'),

  getEdgeCases: () =>
    api.get<{ success: boolean; data: SeedData['edge_cases'] }>('/data/seed/edge-cases'),

  getAllSeedData: () =>
    api.get<{ success: boolean; data: SeedData }>('/data/seed/all'),

  listCorpus: () =>
    api.get<{ success: boolean; data: { count: number; items: any[] } }>('/data/corpus'),

  listFinetune: () =>
    api.get<{ success: boolean; data: { count: number; items: any[] } }>('/data/finetune'),

  importCorpus: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/data/corpus/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  importFinetune: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/data/finetune/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export default api
