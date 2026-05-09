import { v4 as uuidv4 } from 'uuid';
import { CacheEntry, CacheConfig } from '../types';
import { defaultCacheConfig } from '../config/default';

export type CacheStatus = 'VALID' | 'EXPIRED' | 'INVALIDATED' | 'MISSING';

export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  invalidations: number;
  totalEntries: number;
  hitRate: number;
}

export class CacheManager {
  private readonly config: CacheConfig;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly invalidationRules = new Map<string, Set<string>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private statistics: CacheStatistics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    invalidations: 0,
    totalEntries: 0,
    hitRate: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      ...defaultCacheConfig,
      ...config,
    };
    this.startCleanup();
  }

  get<T = unknown>(key: string): { value: T | undefined; status: CacheStatus } {
    const entry = this.cache.get(key);

    if (!entry) {
      this.statistics.misses++;
      return { value: undefined, status: 'MISSING' };
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.statistics.misses++;
      this.statistics.evictions++;
      return { value: undefined, status: 'EXPIRED' };
    }

    this.statistics.hits++;
    return { value: entry.value as T, status: 'VALID' };
  }

  set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      dependencyKeys?: string[];
      version?: number;
    }
  ): CacheEntry<T> {
    this.ensureCapacity();

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      version: options?.version || 1,
      createdAt: now,
      expiresAt: options?.ttl ? now + options.ttl : undefined,
      dependencyKeys: options?.dependencyKeys || [],
    };

    this.cache.set(key, entry);
    this.statistics.totalEntries = this.cache.size;

    if (options?.dependencyKeys) {
      this.registerDependencies(key, options.dependencyKeys);
    }

    return entry;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.unregisterDependencies(key, entry.dependencyKeys);
    }
    const result = this.cache.delete(key);
    this.statistics.totalEntries = this.cache.size;
    return result;
  }

  invalidateByKey(key: string): number {
    let count = 0;

    if (this.cache.delete(key)) {
      count++;
      this.statistics.invalidations++;
    }

    const dependents = this.invalidationRules.get(key);
    if (dependents) {
      for (const dependentKey of dependents) {
        if (this.cache.delete(dependentKey)) {
          count++;
          this.statistics.invalidations++;
        }
      }
    }

    this.statistics.totalEntries = this.cache.size;
    return count;
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        this.unregisterDependencies(key, entry.dependencyKeys);
        if (this.cache.delete(key)) {
          count++;
          this.statistics.invalidations++;
        }
      }
    }

    this.statistics.totalEntries = this.cache.size;
    return count;
  }

  invalidateByDependency(dependencyKey: string): number {
    const dependents = this.invalidationRules.get(dependencyKey);
    if (!dependents) return 0;

    let count = 0;
    for (const key of dependents) {
      const entry = this.cache.get(key);
      if (entry) {
        this.unregisterDependencies(key, entry.dependencyKeys);
      }
      if (this.cache.delete(key)) {
        count++;
        this.statistics.invalidations++;
      }
    }

    this.invalidationRules.delete(dependencyKey);
    this.statistics.totalEntries = this.cache.size;
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.invalidationRules.clear();
    this.statistics.totalEntries = 0;
  }

  getStatistics(): CacheStatistics {
    const totalRequests = this.statistics.hits + this.statistics.misses;
    return {
      ...this.statistics,
      hitRate: totalRequests > 0 ? this.statistics.hits / totalRequests : 0,
    };
  }

  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  private registerDependencies(key: string, dependencyKeys: string[]): void {
    for (const depKey of dependencyKeys) {
      if (!this.invalidationRules.has(depKey)) {
        this.invalidationRules.set(depKey, new Set());
      }
      this.invalidationRules.get(depKey)!.add(key);
    }
  }

  private unregisterDependencies(key: string, dependencyKeys: string[]): void {
    for (const depKey of dependencyKeys) {
      const dependents = this.invalidationRules.get(depKey);
      if (dependents) {
        dependents.delete(key);
        if (dependents.size === 0) {
          this.invalidationRules.delete(depKey);
        }
      }
    }
  }

  private ensureCapacity(): void {
    if (this.cache.size < this.config.maxSize) {
      return;
    }

    const entries = Array.from(this.cache.entries())
      .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

    const removeCount = Math.ceil(this.config.maxSize * 0.1);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const [key, entry] = entries[i];
      this.unregisterDependencies(key, entry.dependencyKeys);
      this.cache.delete(key);
      this.statistics.evictions++;
    }

    this.statistics.totalEntries = this.cache.size;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.unregisterDependencies(key, entry.dependencyKeys);
        this.cache.delete(key);
        this.statistics.evictions++;
      }
    }

    this.statistics.totalEntries = this.cache.size;
  }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
