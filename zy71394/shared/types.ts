export interface Prompt {
  id: string
  title: string
  content: string
  techStacks: string[]
  rating: number
  failureReasons: string[]
  tags: string[]
  currentVersion: number
  status: 'active' | 'deprecated' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface PromptVersion {
  id: string
  promptId: string
  version: number
  content: string
  rating: number
  changeReason: string
  confirmedBy: string | null
  confirmedAt: string | null
  createdAt: string
}

export interface PromptDetail extends Prompt {
  versions: PromptVersion[]
}

export interface Issue {
  id: string
  type: 'duplicate' | 'rating_inconsistency' | 'deprecated_usage'
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'fixing' | 'confirmed' | 'closed'
  description: string
  relatedPromptIds: string[]
  relatedPrompts?: { id: string; title: string }[]
  fixPlan: string | null
  fixedBy: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface IssueLog {
  id: string
  issueId: string
  action: 'created' | 'fix_submitted' | 'fix_confirmed' | 'fix_rejected' | 'closed'
  actor: string
  comment: string
  createdAt: string
}

export interface SearchReport {
  id: string
  query: string
  techStacks: string[]
  resultCount: number
  results: SearchResult[]
  createdAt: string
}

export interface SearchResult {
  promptId: string
  promptTitle: string
  similarity: number
  snippet: string
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean
  duplicates: {
    promptId: string
    title: string
    similarity: number
    version: number
    rating: number
  }[]
}

export interface StatsOverview {
  totalPrompts: number
  activePrompts: number
  totalVersions: number
  openIssues: number
  avgRating: number
}

export interface TechStackStat {
  name: string
  value: number
}

export interface RatingStat {
  rating: number
  count: number
}

export interface FailureStat {
  reason: string
  count: number
}

export interface TrendStat {
  date: string
  count: number
}

export interface CreatePromptRequest {
  title: string
  content: string
  techStacks: string[]
  rating: number
  failureReasons: string[]
  tags: string[]
  changeReason?: string
}

export interface UpdatePromptRequest {
  title: string
  content: string
  techStacks: string[]
  rating: number
  failureReasons: string[]
  tags: string[]
  changeReason: string
  status?: 'active' | 'deprecated' | 'archived'
}

export interface CreateIssueRequest {
  type: Issue['type']
  severity: Issue['severity']
  description: string
  relatedPromptIds: string[]
}

export interface SubmitFixRequest {
  fixPlan: string
  fixedBy: string
}

export interface ConfirmFixRequest {
  confirmedBy: string
  comment?: string
}

export interface SearchRequest {
  query: string
  techStacks?: string[]
  limit?: number
}

export interface PromptFilter {
  techStacks?: string[]
  minRating?: number
  maxRating?: number
  failureReasons?: string[]
  tags?: string[]
  status?: Prompt['status']
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'rating'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
