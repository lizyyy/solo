export interface ManifestEntry {
  path: string
  hash: string
  type: string
  contentLength: number
  lastModified: string
  etag?: string
}

export interface ManifestJson {
  version: string
  commitHash: string
  createdAt: string
  entries: ManifestEntry[]
}

export interface EdgeLogEntry {
  requestId: string
  timestamp: string
  url: string
  method: string
  statusCode: number
  edgeNodeId: string
  cacheStatus: 'HIT' | 'MISS' | 'EXPIRED' | 'REVALIDATED' | 'STALE'
  cacheHitMiss: string
  age: number
  serverTiming?: string
  xCache?: string
  xEdgeLocation?: string
  clientIp: string
  userAgent: string
  referer?: string
  responseTime: number
}

export interface PurgeEventYaml {
  purgeId: string
  action: 'invalidate' | 'delete'
  urls: string[]
  surrogateKeys?: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  edgeNodes?: {
    id: string
    location: string
    status: 'purged' | 'skipped' | 'failed'
  }[]
  skippedNodes?: string[]
}

export interface SimulationConfig {
  type: 'canary' | 'rollback' | 'sw_residue' | 'purge_miss'
  description?: string
  parameters: {
    [key: string]: any
  }
}

export interface RiskResult {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  affectedUrls: string[]
  evidence: any
  suggestion?: string
}

export interface DebugTaskResult {
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  snapshot?: any
  risks?: RiskResult[]
  conclusion?: string
}
