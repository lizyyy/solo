export interface CachePolicy {
  defaultTTL: number;
  entities: Record<string, EntityPolicy>;
  tagRules: TagRule[];
  queryOverrides: Record<string, QueryOverride>;
}

export interface EntityPolicy {
  name: string;
  ttl?: number;
  tags?: string[];
  keyFields: string[];
  dependencies?: string[];
}

export interface TagRule {
  tag: string;
  invalidates: string[];
}

export interface QueryOverride {
  operationName: string;
  ttl?: number;
  tags?: string[];
  cacheKey?: string;
}

export interface GraphQLOperation {
  timestamp: number;
  operationName: string;
  query: string;
  variables: Record<string, any>;
  result: any;
  context?: Record<string, any>;
}

export interface MutationEvent {
  timestamp: number;
  operationName: string;
  mutation: string;
  variables: Record<string, any>;
  result: any;
  affectedEntities: AffectedEntity[];
  context?: Record<string, any>;
}

export interface AffectedEntity {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
}

export interface CacheEntry {
  key: string;
  operationName: string;
  entityKeys: string[];
  tags: string[];
  ttl: number;
  createdAt: number;
  expiresAt: number;
  data: any;
  variables: Record<string, any>;
  query: string;
}

export interface EntityKey {
  type: string;
  id: string;
  key: string;
}

export interface TimelineEvent {
  timestamp: number;
  type: 'query' | 'mutation' | 'invalidation' | 'cache_evict';
  operationName: string;
  details: TimelineEventDetails;
  issues: Issue[];
}

export interface TimelineEventDetails {
  cacheHit?: boolean;
  affectedKeys?: string[];
  evictedKeys?: string[];
  staleData?: boolean;
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: 'high' | 'medium' | 'low';
  timestamp: number;
  operationName: string;
  message: string;
  details: Record<string, any>;
}

export type IssueType = 
  | 'stale_data'
  | 'over_invalidation'
  | 'missing_key'
  | 'out_of_order_mutation'
  | 'ttl_expired'
  | 'cache_miss'
  | 'circular_dependency'
  | 'tag_conflict'
  | 'entity_not_found';

export interface CacheReport {
  summary: {
    totalQueries: number;
    totalMutations: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    invalidations: number;
    issues: {
      total: number;
      byType: Record<IssueType, number>;
      bySeverity: Record<string, number>;
    };
  };
  timeline: TimelineEvent[];
  cacheState: Record<string, CacheEntry>;
  entityDependencyMap: Record<string, string[]>;
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  type: 'policy' | 'invalidation' | 'tagging' | 'ttl' | 'dependency';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedOperations: string[];
}
