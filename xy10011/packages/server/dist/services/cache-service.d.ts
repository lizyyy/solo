declare class CacheService {
    private inMemoryCache;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    invalidate(key: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    invalidateAll(): Promise<void>;
    getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>;
    private isValid;
    private persistCache;
    private getFromDB;
}
export declare const cacheService: CacheService;
export {};
