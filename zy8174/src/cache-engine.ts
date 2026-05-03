import { CacheEntry, CachePolicy, EntityKey, Issue, IssueType } from './types';

export class CacheEngine {
  private cache: Map<string, CacheEntry> = new Map();
  private policy: CachePolicy;
  private issues: Issue[] = [];
  private issueCounter: number = 0;

  constructor(policy: CachePolicy) {
    this.policy = policy;
  }

  get(key: string, currentTime: number): { entry: CacheEntry | null; isHit: boolean; isStale: boolean } {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return { entry: null, isHit: false, isStale: false };
    }
    
    if (currentTime > entry.expiresAt) {
      this.addIssue({
        type: 'ttl_expired',
        severity: 'low',
        timestamp: currentTime,
        operationName: entry.operationName,
        message: `Cache entry for ${entry.operationName} has expired`,
        details: {
          key: entry.key,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
          currentTime
        }
      });
      return { entry: null, isHit: false, isStale: true };
    }
    
    return { entry, isHit: true, isStale: false };
  }

  set(
    key: string,
    operationName: string,
    entityKeys: string[],
    data: any,
    query: string,
    variables: Record<string, any>,
    currentTime: number
  ): CacheEntry {
    const ttl = this.getTTLForOperation(operationName);
    const tags = this.getTagsForOperation(operationName, entityKeys);
    
    const entry: CacheEntry = {
      key,
      operationName,
      entityKeys,
      tags,
      ttl,
      createdAt: currentTime,
      expiresAt: currentTime + ttl * 1000,
      data,
      query,
      variables
    };
    
    this.cache.set(key, entry);
    return entry;
  }

  invalidateByEntityKeys(entityKeys: string[], currentTime: number): string[] {
    const invalidatedKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const hasOverlap = entityKeys.some(ek => entry.entityKeys.includes(ek));
      if (hasOverlap) {
        invalidatedKeys.push(key);
      }
    }
    
    for (const key of invalidatedKeys) {
      this.cache.delete(key);
    }
    
    return invalidatedKeys;
  }

  invalidateByTags(tags: string[], currentTime: number): string[] {
    const invalidatedKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const hasOverlap = tags.some(tag => entry.tags.includes(tag));
      if (hasOverlap) {
        invalidatedKeys.push(key);
      }
    }
    
    for (const key of invalidatedKeys) {
      this.cache.delete(key);
    }
    
    return invalidatedKeys;
  }

  invalidateByTagRules(affectedEntityTypes: string[], currentTime: number): string[] {
    const tagsToInvalidate: string[] = [];
    
    for (const rule of this.policy.tagRules) {
      const affectsEntity = rule.invalidates.some(
        invalidType => affectedEntityTypes.includes(invalidType)
      );
      if (affectsEntity) {
        tagsToInvalidate.push(rule.tag);
      }
    }
    
    return this.invalidateByTags(tagsToInvalidate, currentTime);
  }

  getAllEntityKeys(): string[] {
    const keys = new Set<string>();
    for (const entry of this.cache.values()) {
      for (const key of entry.entityKeys) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  getCacheState(): Record<string, CacheEntry> {
    const state: Record<string, CacheEntry> = {};
    for (const [key, entry] of this.cache.entries()) {
      state[key] = entry;
    }
    return state;
  }

  getIssues(): Issue[] {
    return [...this.issues];
  }

  clearIssues(): void {
    this.issues = [];
  }

  detectCircularDependencies(): { hasCycle: boolean; cycles: string[][] } {
    const cycles: string[][] = [];
    
    const entityDependencies: Map<string, string[]> = new Map();
    
    for (const [entityName, entityPolicy] of Object.entries(this.policy.entities)) {
      entityDependencies.set(entityName, entityPolicy.dependencies || []);
    }
    
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (entity: string): boolean => {
      if (!visited.has(entity)) {
        visited.add(entity);
        recStack.add(entity);
        path.push(entity);
        
        const deps = entityDependencies.get(entity) || [];
        
        for (const dep of deps) {
          if (!visited.has(dep)) {
            if (dfs(dep)) return true;
          } else if (recStack.has(dep)) {
            const cycleStart = path.indexOf(dep);
            if (cycleStart !== -1) {
              const cycle = path.slice(cycleStart);
              cycle.push(dep);
              cycles.push(cycle);
            }
            return true;
          }
        }
      }
      
      recStack.delete(entity);
      path.pop();
      return false;
    };
    
    for (const entity of entityDependencies.keys()) {
      if (!visited.has(entity)) {
        dfs(entity);
      }
    }
    
    if (cycles.length > 0) {
      this.addIssue({
        type: 'circular_dependency',
        severity: 'high',
        timestamp: Date.now(),
        operationName: 'PolicyValidation',
        message: `Circular dependencies detected in cache policy`,
        details: {
          cycles: cycles.map(c => c.join(' -> '))
        }
      });
    }
    
    return { hasCycle: cycles.length > 0, cycles };
  }

  getEntityDependencyMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const [entityName, entityPolicy] of Object.entries(this.policy.entities)) {
      map[entityName] = entityPolicy.dependencies || [];
    }
    return map;
  }

  private getTTLForOperation(operationName: string): number {
    const override = this.policy.queryOverrides[operationName];
    if (override?.ttl !== undefined) {
      return override.ttl;
    }
    return this.policy.defaultTTL;
  }

  private getTagsForOperation(operationName: string, entityKeys: string[]): string[] {
    const tags: Set<string> = new Set();
    
    const override = this.policy.queryOverrides[operationName];
    if (override?.tags) {
      override.tags.forEach(tag => tags.add(tag));
    }
    
    for (const entityKey of entityKeys) {
      const [entityType] = entityKey.split(':');
      const entityPolicy = this.policy.entities[entityType];
      if (entityPolicy?.tags) {
        entityPolicy.tags.forEach(tag => tags.add(tag));
      }
    }
    
    return Array.from(tags);
  }

  private addIssue(issue: Omit<Issue, 'id'>): void {
    this.issues.push({
      ...issue,
      id: `issue-${++this.issueCounter}`
    });
  }
}
