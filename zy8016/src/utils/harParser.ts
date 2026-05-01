import { 
  HARFile, 
  HAREntry, 
  ParsedRequest, 
  ResourceType,
  HARCache
} from '@/types';

const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

const extractPath = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
};

const determineResourceType = (entry: HAREntry): ResourceType => {
  if (entry._resourceType) {
    const type = entry._resourceType.toLowerCase() as ResourceType;
    if (['document', 'stylesheet', 'script', 'image', 'font', 'media', 'xhr', 'fetch', 'websocket'].includes(type)) {
      return type;
    }
  }

  const url = entry.request.url.toLowerCase();
  const contentType = entry.response.content.mimeType?.toLowerCase() || '';

  if (contentType.includes('text/html') || url.endsWith('.html') || url.endsWith('.htm')) {
    return 'document';
  }
  if (contentType.includes('text/css') || url.endsWith('.css')) {
    return 'stylesheet';
  }
  if (contentType.includes('application/javascript') || 
      contentType.includes('text/javascript') || 
      url.endsWith('.js')) {
    return 'script';
  }
  if (contentType.includes('image/') || 
      url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    return 'image';
  }
  if (contentType.includes('font/') || 
      contentType.includes('application/font') ||
      url.match(/\.(woff|woff2|ttf|otf|eot)$/)) {
    return 'font';
  }
  if (contentType.includes('video/') || 
      contentType.includes('audio/') ||
      url.match(/\.(mp4|webm|ogg|mp3|wav|flac)$/)) {
    return 'media';
  }
  if (entry.request.method === 'GET' && 
      (contentType.includes('application/json') || contentType.includes('application/xml'))) {
    return 'xhr';
  }

  return 'other';
};

const detectCacheStatus = (entry: HAREntry): { isFromCache: boolean; cacheStatus: 'hit' | 'miss' | 'none' | 'error' } => {
  if (entry.response.status === 0 || entry.response.status === 206) {
    return { isFromCache: true, cacheStatus: 'hit' };
  }

  if (entry.response.status === 304) {
    return { isFromCache: true, cacheStatus: 'hit' };
  }

  const cache = entry.cache as HARCache | undefined;
  if (cache?.beforeRequest?.hitCount && cache.beforeRequest.hitCount > 0) {
    return { isFromCache: true, cacheStatus: 'hit' };
  }
  if (cache?.afterRequest?.hitCount && cache.afterRequest.hitCount > 0) {
    return { isFromCache: true, cacheStatus: 'hit' };
  }

  const headers = entry.response.headers;
  const cacheControl = headers.find(h => h.name.toLowerCase() === 'cache-control')?.value || '';
  const etag = headers.find(h => h.name.toLowerCase() === 'etag')?.value;
  const lastModified = headers.find(h => h.name.toLowerCase() === 'last-modified')?.value;

  if (cacheControl.includes('no-store') || 
      cacheControl.includes('no-cache') || 
      cacheControl.includes('must-revalidate')) {
    return { isFromCache: false, cacheStatus: 'miss' };
  }

  if (etag || lastModified) {
    return { isFromCache: false, cacheStatus: 'none' };
  }

  return { isFromCache: false, cacheStatus: 'none' };
};

const isThirdPartyRequest = (url: string, firstPartyDomains: string[]): boolean => {
  const domain = extractDomain(url);
  
  for (const fpDomain of firstPartyDomains) {
    if (domain === fpDomain || domain.endsWith(`.${fpDomain}`)) {
      return false;
    }
  }
  
  return true;
};

const normalizeTiming = (value: number | undefined, defaultValue: number = 0): number => {
  if (value === undefined || value === null || isNaN(value) || value < 0) {
    return defaultValue;
  }
  return value;
};

const hasMissingTiming = (entry: HAREntry): boolean => {
  const timings = entry.timings;
  if (!timings) return true;
  
  const requiredFields = ['blocked', 'dns', 'connect', 'send', 'wait', 'receive'];
  for (const field of requiredFields) {
    const value = (timings as any)[field];
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      return true;
    }
  }
  
  return false;
};

const getHttp2Status = (entry: HAREntry): { protocol: string; isHttp2: boolean } => {
  const httpVersion = entry.response.httpVersion || entry.request.httpVersion || '';
  const protocol = httpVersion;
  const isHttp2 = httpVersion.toLowerCase().includes('h2') || 
                  httpVersion.toLowerCase().includes('http/2') ||
                  httpVersion === '2.0';
  
  return { protocol, isHttp2 };
};

const findDuplicateRequests = (entries: HAREntry[]): Map<string, number> => {
  const urlCount = new Map<string, number>();
  
  for (const entry of entries) {
    const url = entry.request.url;
    urlCount.set(url, (urlCount.get(url) || 0) + 1);
  }
  
  return urlCount;
};

export const parseHAR = (
  harData: HARFile, 
  options: { firstPartyDomains?: string[] } = {}
): { 
  parsedRequests: ParsedRequest[];
  firstPartyDomains: string[];
  warnings: string[];
} => {
  const warnings: string[] = [];
  const entries = harData.log.entries;
  
  if (!entries || entries.length === 0) {
    warnings.push('HAR 文件中没有请求记录');
    return { parsedRequests: [], firstPartyDomains: [], warnings };
  }

  let firstPartyDomains = options.firstPartyDomains || [];
  if (firstPartyDomains.length === 0) {
    const firstEntry = entries[0];
    const mainDomain = extractDomain(firstEntry.request.url);
    firstPartyDomains = [mainDomain];
    warnings.push(`自动检测的主域名: ${mainDomain}`);
  }

  const duplicateUrlMap = findDuplicateRequests(entries);

  const parsedRequests: ParsedRequest[] = entries.map((entry, index) => {
    const { protocol, isHttp2 } = getHttp2Status(entry);
    const { isFromCache, cacheStatus } = detectCacheStatus(entry);
    const url = entry.request.url;
    const domain = extractDomain(url);
    const hasMissing = hasMissingTiming(entry);
    const duplicateCount = duplicateUrlMap.get(url) || 1;
    
    if (hasMissing) {
      warnings.push(`请求 ${index + 1} (${url}) 缺少 timing 数据`);
    }
    
    if (duplicateCount > 1) {
      warnings.push(`检测到重复 URL: ${url} (出现 ${duplicateCount} 次)`);
    }

    const startTime = new Date(entry.startedDateTime).getTime();
    const totalTime = normalizeTiming(entry.time, 0);
    const endTime = startTime + totalTime;

    const blockedTime = normalizeTiming(entry.timings?.blocked, 0);
    const dnsTime = normalizeTiming(entry.timings?.dns, 0);
    const connectTime = normalizeTiming(entry.timings?.connect, 0);
    const sslTime = normalizeTiming(entry.timings?.ssl, 0);
    const sendTime = normalizeTiming(entry.timings?.send, 0);
    const waitTime = normalizeTiming(entry.timings?.wait, 0);
    const receiveTime = normalizeTiming(entry.timings?.receive, 0);

    const requestSize = normalizeTiming(entry.request.headersSize, 0) + normalizeTiming(entry.request.bodySize, 0);
    const responseSize = normalizeTiming(entry.response.headersSize, 0) + normalizeTiming(entry.response.bodySize, 0);
    const transferSize = normalizeTiming(entry.response._transferSize, responseSize);
    const compressedSize = normalizeTiming(entry.response.content.compression, 0);

    const parsedRequest: ParsedRequest = {
      id: `request-${index}`,
      index,
      url,
      method: entry.request.method,
      status: entry.response.status,
      statusText: entry.response.statusText,
      resourceType: determineResourceType(entry),
      protocol,
      isHttp2,
      
      startTime,
      endTime,
      totalTime,
      
      blockedTime,
      dnsTime,
      connectTime,
      sslTime,
      sendTime,
      waitTime,
      receiveTime,
      
      requestSize,
      responseSize,
      transferSize,
      compressedSize,
      
      headers: [...entry.request.headers, ...entry.response.headers],
      requestHeaders: entry.request.headers,
      responseHeaders: entry.response.headers,
      
      isFromCache,
      cacheStatus,
      
      isThirdParty: isThirdPartyRequest(url, firstPartyDomains),
      domain,
      path: extractPath(url),
      
      hasMissingTiming: hasMissing,
      isDuplicate: duplicateCount > 1,
      duplicateCount,
      
      serverIPAddress: entry.serverIPAddress,
      connection: entry.connection,
      
      rawEntry: entry,
    };

    return parsedRequest;
  });

  return {
    parsedRequests,
    firstPartyDomains,
    warnings,
  };
};

export const getPageTimings = (harData: HARFile): { domContentLoaded: number; onLoad: number } => {
  const pages = harData.log.pages;
  
  if (pages && pages.length > 0) {
    const page = pages[0];
    return {
      domContentLoaded: page.pageTimings?.onContentLoad || 0,
      onLoad: page.pageTimings?.onLoad || 0,
    };
  }
  
  const entries = harData.log.entries;
  if (entries.length === 0) {
    return { domContentLoaded: 0, onLoad: 0 };
  }

  const firstEntry = entries[0];
  const startTime = new Date(firstEntry.startedDateTime).getTime();
  const lastEntry = entries[entries.length - 1];
  const lastEndTime = new Date(lastEntry.startedDateTime).getTime() + lastEntry.time;
  
  const estimatedOnLoad = lastEndTime - startTime;
  
  return {
    domContentLoaded: estimatedOnLoad * 0.7,
    onLoad: estimatedOnLoad,
  };
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatMilliseconds = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60000).toFixed(2)} min`;
};
