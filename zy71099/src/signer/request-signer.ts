import { createHash } from 'crypto';
import stableStringify from 'json-stable-stringify';
import { HTTPRequest, DiffConfig } from '../types';

export interface RequestSignature {
  id: string;
  method: string;
  path: string;
  normalizedPath: string;
  queryHash: string;
  bodyHash: string;
  headersHash: string;
  fullHash: string;
}

export class RequestSigner {
  private config: DiffConfig;
  private pathPatterns: RegExp[] = [];

  constructor(config: DiffConfig) {
    this.config = config;
    this.compilePathPatterns();
  }

  private compilePathPatterns(): void {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const numberPattern = /\/\d+(?=\/|$)/g;
    const idPattern = /[_-]id_\d+/g;
    
    this.pathPatterns = [uuidPattern, numberPattern, idPattern];
  }

  sign(request: HTTPRequest): RequestSignature {
    const method = request.method.toUpperCase();
    const path = request.uri;
    const normalizedPath = this.normalizePath(path);
    
    const queryHash = this.hashQuery(request.query || {});
    const bodyHash = this.hashBody(request.body);
    const headersHash = this.hashHeaders(request.headers);

    const signatureData = {
      method,
      normalizedPath,
      queryHash,
      bodyHash,
      headersHash
    };

    const fullHash = this.hash(stableStringify(signatureData) || '');

    return {
      id: `${method}_${normalizedPath}_${fullHash.substring(0, 8)}`,
      method,
      path,
      normalizedPath,
      queryHash,
      bodyHash,
      headersHash,
      fullHash
    };
  }

  private normalizePath(path: string): string {
    let normalized = path;
    
    for (const pattern of this.pathPatterns) {
      normalized = normalized.replace(pattern, '/{var}');
    }
    
    return normalized;
  }

  private hashQuery(query: Record<string, string | string[]>): string {
    const filteredQuery: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(query)) {
      if (this.shouldIgnoreField(`query.${key}`)) {
        continue;
      }
      filteredQuery[key] = this.normalizeQueryValue(value);
    }

    if (Object.keys(filteredQuery).length === 0) {
      return 'empty';
    }

    return this.hash(stableStringify(filteredQuery) || '');
  }

  private normalizeQueryValue(value: string | string[]): any {
    if (Array.isArray(value)) {
      return value.sort().map(v => this.maskValue(v));
    }
    return this.maskValue(value);
  }

  private hashBody(body: any): string {
    if (body === undefined || body === null) {
      return 'empty';
    }

    const normalizedBody = this.normalizeValue(body, 'body');
    
    if (this.isEmptyValue(normalizedBody)) {
      return 'empty';
    }

    return this.hash(stableStringify(normalizedBody) || '');
  }

  private hashHeaders(headers: Record<string, string | string[]>): string {
    if (!this.config.normalizeHeaders) {
      return 'ignored';
    }

    const significantHeaders = [
      'content-type',
      'accept',
      'authorization',
      'x-request-id'
    ];

    const filteredHeaders: Record<string, any> = {};
    
    for (const header of significantHeaders) {
      const value = headers[header];
      if (value !== undefined && !this.shouldIgnoreField(`header.${header}`)) {
        filteredHeaders[header] = this.normalizeHeaderValue(value);
      }
    }

    if (Object.keys(filteredHeaders).length === 0) {
      return 'empty';
    }

    return this.hash(stableStringify(filteredHeaders) || '');
  }

  private normalizeHeaderValue(value: string | string[]): any {
    if (Array.isArray(value)) {
      return value.map(v => this.maskValue(v));
    }
    return this.maskValue(value);
  }

  private normalizeValue(value: any, prefix: string = ''): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (this.shouldIgnoreField(prefix)) {
      return '__IGNORED__';
    }

    if (typeof value === 'string') {
      return this.maskValue(value);
    }

    if (Array.isArray(value)) {
      const result = value.map((item, index) => 
        this.normalizeValue(item, `${prefix}[${index}]`)
      );
      return this.config.ignoreOrder ? this.sortArray(result) : result;
    }

    if (typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        if (!this.shouldIgnoreField(fieldPath)) {
          result[key] = this.normalizeValue(val, fieldPath);
        }
      }
      return result;
    }

    return value;
  }

  private maskValue(str: string): string {
    for (const rule of this.config.maskingRules) {
      if (rule.pattern && rule.replacement) {
        try {
          const regex = new RegExp(rule.pattern, 'g');
          str = str.replace(regex, rule.replacement);
        } catch {
        }
      }
    }
    return str;
  }

  private shouldIgnoreField(fieldPath: string): boolean {
    for (const ignoreField of this.config.ignoreFields) {
      if (this.matchFieldPattern(fieldPath, ignoreField)) {
        return true;
      }
    }
    return false;
  }

  private matchFieldPattern(fieldPath: string, pattern: string): boolean {
    if (pattern === fieldPath) {
      return true;
    }

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(fieldPath);
    } catch {
      return false;
    }
  }

  private sortArray(arr: any[]): any[] {
    return [...arr].sort((a, b) => {
      const strA = (typeof a === 'string' ? a : stableStringify(a)) || '';
      const strB = (typeof b === 'string' ? b : stableStringify(b)) || '';
      return strA.localeCompare(strB);
    });
  }

  private isEmptyValue(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  }

  private hash(str: string): string {
    return createHash('sha256').update(str).digest('hex');
  }
}

export function createRequestSigner(config: DiffConfig): RequestSigner {
  return new RequestSigner(config);
}

export function calculateSimilarity(
  sig1: RequestSignature,
  sig2: RequestSignature
): number {
  let score = 0;
  const total = 4;

  if (sig1.method === sig2.method) score++;
  if (sig1.normalizedPath === sig2.normalizedPath) score++;
  if (sig1.queryHash === sig2.queryHash) score++;
  if (sig1.bodyHash === sig2.bodyHash) score++;

  return score / total;
}

export function findBestMatch(
  target: RequestSignature,
  candidates: RequestSignature[],
  threshold: number = 0.5
): { signature: RequestSignature; score: number } | null {
  let bestMatch: { signature: RequestSignature; score: number } | null = null;

  for (const candidate of candidates) {
    const score = calculateSimilarity(target, candidate);
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { signature: candidate, score };
    }
  }

  return bestMatch;
}
