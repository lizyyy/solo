"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpChecker = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const MAX_REDIRECTS = 10;
const TIMEOUT = 30000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SitemapAuditBot/1.0; +https://github.com/sitemap-audit)';
class HttpChecker {
    concurrency;
    constructor(concurrency = 5) {
        this.concurrency = concurrency;
    }
    async checkAll(entries) {
        const results = [];
        const chunks = this.chunkArray(entries, this.concurrency);
        for (const chunk of chunks) {
            const chunkResults = await Promise.all(chunk.map(entry => this.checkUrl(entry)));
            results.push(...chunkResults);
        }
        return results;
    }
    async checkUrl(entry) {
        const startTime = Date.now();
        const redirectChain = [];
        let currentUrl = entry.url;
        let finalResponse = null;
        let redirectCount = 0;
        try {
            while (redirectCount < MAX_REDIRECTS) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
                const response = await (0, node_fetch_1.default)(currentUrl, {
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
                return this.createErrorResult(entry, redirectChain, redirectCount, Date.now() - startTime, `超过最大跳转次数 (${MAX_REDIRECTS})`);
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
        }
        catch (error) {
            return this.createErrorResult(entry, redirectChain, redirectCount, Date.now() - startTime, this.getErrorMessage(error));
        }
    }
    async readResponseText(response) {
        try {
            const buffer = await response.buffer();
            return buffer.toString('utf-8');
        }
        catch {
            return '';
        }
    }
    extractTitle(html) {
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return match ? match[1].trim() : undefined;
    }
    createErrorResult(entry, redirectChain, redirectCount, responseTime, error) {
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
    getErrorMessage(error) {
        if (error.name === 'AbortError') {
            return '请求超时';
        }
        if (error.name === 'FetchError') {
            const fetchError = error;
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
    resolveUrl(baseUrl, relativeUrl) {
        try {
            return new URL(relativeUrl, baseUrl).href;
        }
        catch {
            return relativeUrl;
        }
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
exports.HttpChecker = HttpChecker;
//# sourceMappingURL=http-checker.js.map