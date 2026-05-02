import * as fs from 'fs';
import * as path from 'path';
import fetch, { RequestInit, Response } from 'node-fetch';
import pLimit from 'p-limit';
import { ExternalCheckResult, ExternalCacheEntry, Config } from '../types';
import { sleep, ensureDir, matchesIgnoreUrls } from '../utils';

export class ExternalValidator {
  private config: Config;
  private cache: Map<string, ExternalCacheEntry> = new Map();
  private limit: ReturnType<typeof pLimit>;

  constructor(config: Config) {
    this.config = config;
    this.limit = pLimit(config.external.concurrency);
    this.loadCache();
  }

  private loadCache(): void {
    const cacheDir = path.resolve(process.cwd(), this.config.external.cacheDir);
    const cacheFile = path.join(cacheDir, 'external-checks.json');

    if (fs.existsSync(cacheFile)) {
      try {
        const content = fs.readFileSync(cacheFile, 'utf-8');
        const entries: ExternalCacheEntry[] = JSON.parse(content);
        const now = Date.now();
        
        for (const entry of entries) {
          if (entry.expiresAt > now) {
            this.cache.set(entry.url, entry);
          }
        }
      } catch (error) {
        console.warn(`警告: 无法加载缓存: ${(error as Error).message}`);
      }
    }
  }

  saveCache(): void {
    if (this.cache.size === 0) return;

    const cacheDir = path.resolve(process.cwd(), this.config.external.cacheDir);
    ensureDir(cacheDir);
    
    const cacheFile = path.join(cacheDir, 'external-checks.json');
    const entries = Array.from(this.cache.values());

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`警告: 无法保存缓存: ${(error as Error).message}`);
    }
  }

  private getFromCache(url: string): ExternalCheckResult | null {
    const entry = this.cache.get(url);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.cache.delete(url);
      return null;
    }

    return {
      url: entry.url,
      status: entry.status,
      statusCode: entry.statusCode,
      message: entry.message,
      fromCache: true,
      cachedAt: entry.checkedAt
    };
  }

  private setCache(url: string, result: Omit<ExternalCacheEntry, 'checkedAt' | 'expiresAt'>): void {
    const now = Date.now();
    const entry: ExternalCacheEntry = {
      ...result,
      checkedAt: now,
      expiresAt: now + this.config.external.cacheTTL
    };
    this.cache.set(url, entry);
  }

  async validate(url: string): Promise<ExternalCheckResult> {
    if (matchesIgnoreUrls(url, this.config.ignoreUrls)) {
      return {
        url,
        status: 'skipped',
        message: 'URL 在忽略列表中'
      };
    }

    const cached = this.getFromCache(url);
    if (cached) {
      return cached;
    }

    return this.limit(() => this.checkUrlWithRetry(url));
  }

  private async checkUrlWithRetry(url: string): Promise<ExternalCheckResult> {
    const maxRetries = this.config.external.retries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.checkUrl(url);
        
        if (result.status === 'valid') {
          this.setCache(url, {
            url,
            status: result.status,
            statusCode: result.statusCode,
            message: result.message
          });
          return result;
        }

        if (attempt < maxRetries) {
          await sleep(this.config.external.retryDelay * (attempt + 1));
        } else {
          this.setCache(url, {
            url,
            status: 'invalid',
            statusCode: result.statusCode,
            message: result.message
          });
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await sleep(this.config.external.retryDelay * (attempt + 1));
        }
      }
    }

    const errorMessage = lastError ? lastError.message : '未知错误';
    const result: ExternalCheckResult = {
      url,
      status: 'invalid',
      message: `请求失败: ${errorMessage} (重试 ${maxRetries} 次后)`
    };

    this.setCache(url, {
      url,
      status: 'invalid',
      message: result.message
    });

    return result;
  }

  private async checkUrl(url: string): Promise<ExternalCheckResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.external.timeout
    );

    try {
      const options: RequestInit = {
        method: 'HEAD',
        headers: {
          'User-Agent': this.config.external.userAgent
        },
        signal: controller.signal
      };

      let response: Response;
      try {
        response = await fetch(url, options);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return {
            url,
            status: 'invalid',
            message: `请求超时 (${this.config.external.timeout}ms)`
          };
        }
        
        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
          return {
            url,
            status: 'invalid',
            message: `DNS 解析失败: ${error.code}`
          };
        }

        const getOptions: RequestInit = {
          method: 'GET',
          headers: {
            'User-Agent': this.config.external.userAgent
          },
          signal: controller.signal
        };
        
        response = await fetch(url, getOptions);
      }

      const statusCode = response.status;

      if (statusCode >= 200 && statusCode < 400) {
        return {
          url,
          status: 'valid',
          statusCode,
          message: `HTTP ${statusCode} ${response.statusText}`
        };
      }

      if (statusCode === 401 || statusCode === 403) {
        return {
          url,
          status: 'warning',
          statusCode,
          message: `需要认证: HTTP ${statusCode}`
        };
      }

      if (statusCode >= 400 && statusCode < 500) {
        return {
          url,
          status: 'invalid',
          statusCode,
          message: `客户端错误: HTTP ${statusCode} ${response.statusText}`
        };
      }

      if (statusCode >= 500) {
        return {
          url,
          status: 'invalid',
          statusCode,
          message: `服务器错误: HTTP ${statusCode} ${response.statusText}`
        };
      }

      return {
        url,
        status: 'warning',
        statusCode,
        message: `不明确的状态码: HTTP ${statusCode}`
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          url,
          status: 'invalid',
          message: `请求超时 (${this.config.external.timeout}ms)`
        };
      }

      return {
        url,
        status: 'invalid',
        message: `请求失败: ${error.message || error.code || '未知错误'}`
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async validateBatch(urls: string[]): Promise<Map<string, ExternalCheckResult>> {
    const results = new Map<string, ExternalCheckResult>();
    const uniqueUrls = [...new Set(urls)];

    const promises = uniqueUrls.map(async (url) => {
      const result = await this.validate(url);
      results.set(url, result);
    });

    await Promise.all(promises);
    return results;
  }

  clearCache(): void {
    this.cache.clear();
    
    const cacheDir = path.resolve(process.cwd(), this.config.external.cacheDir);
    const cacheFile = path.join(cacheDir, 'external-checks.json');
    
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  }

  getCacheStats(): { cached: number; expired: number } {
    const now = Date.now();
    let cached = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt > now) {
        cached++;
      } else {
        expired++;
      }
    }

    return { cached, expired };
  }
}
