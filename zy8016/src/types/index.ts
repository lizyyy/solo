export interface HARFile {
  log: HARLog;
}

export interface HARLog {
  version: string;
  creator: HARCreator;
  entries: HAREntry[];
  pages?: HARPage[];
}

export interface HARCreator {
  name: string;
  version: string;
}

export interface HARPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: {
    onContentLoad: number;
    onLoad: number;
  };
}

export interface HAREntry {
  _resourceType?: string;
  startedDateTime: string;
  time: number;
  request: HARRequest;
  response: HARResponse;
  timings: HARTimings;
  cache?: HARCache;
  serverIPAddress?: string;
  connection?: string;
  pageref?: string;
}

export interface HARRequest {
  method: string;
  url: string;
  httpVersion: string;
  headers: HARHeader[];
  queryString: HARQueryParam[];
  cookies: HARCookie[];
  headersSize: number;
  bodySize: number;
}

export interface HARResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  headers: HARHeader[];
  cookies: HARCookie[];
  content: HARContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  _transferSize?: number;
}

export interface HARTimings {
  blocked: number;
  dns: number;
  connect: number;
  send: number;
  wait: number;
  receive: number;
  ssl: number;
}

export interface HARHeader {
  name: string;
  value: string;
}

export interface HARQueryParam {
  name: string;
  value: string;
}

export interface HARCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HARContent {
  size: number;
  mimeType: string;
  compression?: number;
  text?: string;
  encoding?: string;
}

export interface HARCache {
  beforeRequest?: {
    expires?: string;
    lastAccess: string;
    eTag?: string;
    hitCount: number;
  };
  afterRequest?: {
    expires?: string;
    lastAccess: string;
    eTag?: string;
    hitCount: number;
  };
}

export type ResourceType = 
  | 'document'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'media'
  | 'xhr'
  | 'fetch'
  | 'websocket'
  | 'other';

export interface ParsedRequest {
  id: string;
  index: number;
  url: string;
  method: string;
  status: number;
  statusText: string;
  resourceType: ResourceType;
  protocol: string;
  isHttp2: boolean;
  
  startTime: number;
  endTime: number;
  totalTime: number;
  
  blockedTime: number;
  dnsTime: number;
  connectTime: number;
  sslTime: number;
  sendTime: number;
  waitTime: number;
  receiveTime: number;
  
  requestSize: number;
  responseSize: number;
  transferSize: number;
  compressedSize: number;
  
  headers: HARHeader[];
  requestHeaders: HARHeader[];
  responseHeaders: HARHeader[];
  
  isFromCache: boolean;
  cacheStatus: 'hit' | 'miss' | 'none' | 'error';
  
  isThirdParty: boolean;
  domain: string;
  path: string;
  
  hasMissingTiming: boolean;
  isDuplicate: boolean;
  duplicateCount: number;
  
  serverIPAddress?: string;
  connection?: string;
  
  rawEntry: HAREntry;
}

export interface PerformanceBudget {
  page: string;
  thresholds: {
    totalRequests?: number;
    totalSize?: number;
    resourceTypes?: {
      [key in ResourceType]?: {
        count?: number;
        size?: number;
      };
    };
    timing?: {
      domContentLoaded?: number;
      onLoad?: number;
      firstContentfulPaint?: number;
      timeToInteractive?: number;
    };
    thirdParty?: {
      count?: number;
      size?: number;
      domains?: string[];
    };
    cache?: {
      missRate?: number;
    };
  };
}

export type BudgetIssueType = 
  | 'total_requests'
  | 'total_size'
  | 'resource_type_count'
  | 'resource_type_size'
  | 'third_party_count'
  | 'third_party_size'
  | 'cache_miss_rate'
  | 'duplicate_request'
  | 'missing_timing'
  | 'large_resource'
  | 'slow_resource';

export interface BudgetIssue {
  type: BudgetIssueType;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  threshold?: number;
  actual?: number;
  requests?: ParsedRequest[];
  resourceType?: ResourceType;
}

export interface AnalysisResult {
  pageInfo: {
    startedDateTime: string;
    domContentLoadedTime: number;
    onLoadTime: number;
    totalRequests: number;
    totalSize: number;
    totalTransferSize: number;
  };
  
  requests: ParsedRequest[];
  resourceTypeStats: {
    [key in ResourceType]: {
      count: number;
      size: number;
      transferSize: number;
    };
  };
  
  cacheStats: {
    hitCount: number;
    missCount: number;
    noneCount: number;
    hitRate: number;
  };
  
  thirdPartyStats: {
    domains: {
      domain: string;
      count: number;
      size: number;
    }[];
    totalCount: number;
    totalSize: number;
  };
  
  issues: BudgetIssue[];
  
  timingStats: {
    domContentLoaded: number;
    onLoad: number;
    longestRequest: number;
    avgRequestTime: number;
  };
  
  warnings: string[];
}

export interface ExportOptions {
  format: 'markdown' | 'html';
  includeDetails: boolean;
  includeWaterfall: boolean;
}
