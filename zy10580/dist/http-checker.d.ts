import { SitemapEntry, UrlCheckResult } from './types';
export declare class HttpChecker {
    private concurrency;
    constructor(concurrency?: number);
    checkAll(entries: SitemapEntry[]): Promise<UrlCheckResult[]>;
    private checkUrl;
    private readResponseText;
    private extractTitle;
    private createErrorResult;
    private getErrorMessage;
    private resolveUrl;
    private chunkArray;
}
