import fetch, { Response, FetchError } from 'node-fetch';
import { SitemapEntry, UrlCheckResult, RedirectStep } from './types';

const MAX_REDIRECTS = 10;
const TIMEOUT = 30000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SitemapAuditBot/1.0; +https://github.com/sitemap-audit)';

export class HttpChecker {
  private concurrency: number;

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  async checkAll(entries: SitemapEntry[]): Promise<UrlCheckResult[]> {
    const results: UrlCheckResult[] = [];
    const chunks = this.chunkArray(entries, this.concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(entry => this.checkUrl(entry))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private async checkUrl(entry: SitemapEntry): Promise<UrlCheckResult> {
    const startTime = Date.now();
    const redirectChain: RedirectStep[] = [];
    let currentUrl = entry.url;
    let finalResponse: Response | null = null;
    let redirectCount = 0;

    try {
      while (redirectCount < MAX_REDIRECTS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'manual',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const status = response.status;
        const statusText = response.statusText;

        redirectChain.push({
          url: currentUrl,
          status,
          statusText,
        });

        if (status >= 300 && status < 400) {
          const location = response.headers.get('location');
          if (!location) {
            break;
          }
          currentUrl = this.resolveUrl(currentUrl, location);
          redirectCount++;
          continue;
        }

        finalResponse = response;
        break;
      }

      if (!finalResponse) {
        return this.createErrorResult(
          entry,
          redirectChain,
          redirectCount,
          Date.now() - startTime,
          `超过最大跳转次数 (${MAX_REDIRECTS})`
        );
      }

      const contentType = finalResponse.headers.get('content-type') || '';
      const text = await this.readResponseText(finalResponse);
      const title = this.extractTitle(text);

      const finalUrl = currentUrl;
      const is404 = finalResponse.status === 404;
      const isRedirect = redirectCount > 0;

      return {
        originalUrl: entry.url,
        finalUrl,
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        ok: finalResponse.ok,
        redirectChain,
        redirectCount,
        title,
        contentType,
        responseTime: Date.now() - startTime,
        sourceFile: entry.sourceFile,
        lineNumber: entry.lineNumber,
        is404,
        isRedirect,
      };

    } catch (error) {
      return this.createErrorResult(
        entry,
        redirectChain,
        redirectCount,
        Date.now() - startTime,
        this.getErrorMessage(error as Error)
      );
    }
  }

  private async readResponseText(response: Response): Promise<string> {
    try {
      const buffer = await response.buffer();
      return buffer.toString('utf-8');
    } catch {
      return '';
    }
  }

  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : undefined;
  }

  private createErrorResult(
    entry: SitemapEntry,
    redirectChain: RedirectStep[],
    redirectCount: number,
    responseTime: number,
    error: string
  ): UrlCheckResult {
    const lastRedirect = redirectChain[redirectChain.length - 1];
    return {
      originalUrl: entry.url,
      finalUrl: lastRedirect?.url || entry.url,
      status: lastRedirect?.status || 0,
      statusText: lastRedirect?.statusText || 'Error',
      ok: false,
      redirectChain,
      redirectCount,
      responseTime,
      error,
      sourceFile: entry.sourceFile,
      lineNumber: entry.lineNumber,
      is404: lastRedirect?.status === 404,
      isRedirect: redirectCount > 0,
    };
  }

  private getErrorMessage(error: Error): string {
    if (error.name === 'AbortError') {
      return '请求超时';
    }
    if (error.name === 'FetchError') {
      const fetchError = error as FetchError;
      if (fetchError.code === 'ENOTFOUND') {
        return '域名不存在';
      }
      if (fetchError.code === 'ECONNREFUSED') {
        return '连接被拒绝';
      }
      if (fetchError.code === 'ETIMEDOUT') {
        return '连接超时';
      }
    }
    return error.message || '未知错误';
  }

  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
