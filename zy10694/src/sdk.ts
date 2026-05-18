import axios from 'axios';
import { CreateExtensionRequest, DeprecationExtension, ExtensionStatus, SyncCheckResult } from './types';

export class DeprecationExtensionSDK {
  private baseURL: string;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL: number;

  constructor(baseURL: string = 'http://localhost:3000/api/v1/deprecation-extension', cacheTTL: number = 300000) {
    this.baseURL = baseURL;
    this.cache = new Map();
    this.cacheTTL = cacheTTL;
  }

  private getCacheKey(method: string, url: string, data?: any): string {
    return `${method}:${url}:${JSON.stringify(data || {})}`;
  }

  private async request<T>(
    method: 'get' | 'post' | 'patch',
    url: string,
    data?: any,
    useCache: boolean = false
  ): Promise<T> {
    const cacheKey = this.getCacheKey(method, url, data);

    if (useCache && method === 'get') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${url}`,
        data
      });

      const result = response.data as any;
      if (!result.success) {
        throw new Error(result.error);
      }

      if (useCache && method === 'get') {
        this.cache.set(cacheKey, {
          data: result.data,
          timestamp: Date.now()
        });
      }

      return result.data;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  async createExtension(request: CreateExtensionRequest): Promise<DeprecationExtension> {
    return this.request('post', '/extensions', request);
  }

  async getExtension(id: string): Promise<DeprecationExtension> {
    return this.request('get', `/extensions/${id}`);
  }

  async listExtensions(filters?: {
    status?: ExtensionStatus;
    caller?: string;
    apiPath?: string;
  }, useCache: boolean = false): Promise<DeprecationExtension[]> {
    let url = '/extensions';
    const params: string[] = [];
    if (filters?.status) params.push(`status=${filters.status}`);
    if (filters?.caller) params.push(`caller=${encodeURIComponent(filters.caller)}`);
    if (filters?.apiPath) params.push(`apiPath=${encodeURIComponent(filters.apiPath)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    return this.request('get', url, undefined, useCache);
  }

  async approveExtension(id: string, approvedBy: string): Promise<DeprecationExtension> {
    return this.request('post', `/extensions/${id}/approve`, { approvedBy });
  }

  async rejectExtension(id: string, approvedBy: string): Promise<DeprecationExtension> {
    return this.request('post', `/extensions/${id}/reject`, { approvedBy });
  }

  async withdrawExtension(id: string): Promise<DeprecationExtension> {
    return this.request('post', `/extensions/${id}/withdraw`);
  }

  async checkSyncStatus(apiPath: string, caller?: string): Promise<SyncCheckResult[]> {
    let url = `/sync-check?apiPath=${encodeURIComponent(apiPath)}`;
    if (caller) url += `&caller=${encodeURIComponent(caller)}`;
    return this.request('get', url);
  }

  async getUnsyncedExtensions(): Promise<DeprecationExtension[]> {
    return this.request('get', '/unsynced');
  }

  async getExpiringExtensions(daysBefore: number = 7): Promise<DeprecationExtension[]> {
    return this.request('get', `/expiring?daysBefore=${daysBefore}`);
  }

  async exportExtensions(format: 'json' | 'csv', filters?: {
    status?: ExtensionStatus;
    caller?: string;
  }): Promise<string> {
    let url = `/export?format=${format}`;
    if (filters?.status) url += `&status=${filters.status}`;
    if (filters?.caller) url += `&caller=${encodeURIComponent(filters.caller)}`;
    return this.request('get', url);
  }

  async updateSyncStatus(
    id: string,
    syncStatus: 'synced' | 'pending' | 'failed',
    syncMessage?: string
  ): Promise<DeprecationExtension> {
    return this.request('patch', `/extensions/${id}/sync-status`, {
      syncStatus,
      syncMessage
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}
