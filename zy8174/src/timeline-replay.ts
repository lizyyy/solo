import { 
  GraphQLOperation, 
  MutationEvent, 
  TimelineEvent, 
  CacheReport, 
  Issue, 
  IssueType,
  Recommendation
} from './types';
import { CacheEngine } from './cache-engine';
import { Parser } from './parser';
import { DocumentNode } from 'graphql';

interface ReplayEvent {
  timestamp: number;
  type: 'query' | 'mutation';
  originalEvent: GraphQLOperation | MutationEvent;
}

export class TimelineReplay {
  private cacheEngine: CacheEngine;
  private parser: Parser;
  private schemaDocument: DocumentNode;
  private events: ReplayEvent[] = [];
  private timeline: TimelineEvent[] = [];
  private issues: Issue[] = [];
  private issueCounter: number = 0;
  private stats = {
    totalQueries: 0,
    totalMutations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    invalidations: 0
  };

  constructor(
    cacheEngine: CacheEngine,
    parser: Parser,
    schemaDocument: DocumentNode,
    operations: GraphQLOperation[],
    mutations: MutationEvent[]
  ) {
    this.cacheEngine = cacheEngine;
    this.parser = parser;
    this.schemaDocument = schemaDocument;
    this.events = this.mergeEvents(operations, mutations);
  }

  private mergeEvents(
    operations: GraphQLOperation[],
    mutations: MutationEvent[]
  ): ReplayEvent[] {
    const events: ReplayEvent[] = [
      ...operations.map(op => ({
        timestamp: op.timestamp,
        type: 'query' as const,
        originalEvent: op
      })),
      ...mutations.map(mut => ({
        timestamp: mut.timestamp,
        type: 'mutation' as const,
        originalEvent: mut
      }))
    ];
    
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  replay(): CacheReport {
    this.timeline = [];
    this.issues = [];
    this.stats = {
      totalQueries: 0,
      totalMutations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      invalidations: 0
    };

    this.cacheEngine.clearIssues();
    const cycleResult = this.cacheEngine.detectCircularDependencies();
    if (cycleResult.hasCycle) {
      const engineIssues = this.cacheEngine.getIssues();
      this.issues.push(...engineIssues);
    }

    this.checkOutOfOrderMutations();

    for (const event of this.events) {
      if (event.type === 'query') {
        this.processQuery(event.originalEvent as GraphQLOperation);
      } else {
        this.processMutation(event.originalEvent as MutationEvent);
      }
    }

    const cacheHitRate = this.stats.totalQueries > 0 
      ? this.stats.cacheHits / this.stats.totalQueries 
      : 0;

    const issuesByType = this.groupIssuesByType();
    const issuesBySeverity = this.groupIssuesBySeverity();

    const recommendations = this.generateRecommendations(cacheHitRate);

    return {
      summary: {
        totalQueries: this.stats.totalQueries,
        totalMutations: this.stats.totalMutations,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        cacheHitRate,
        invalidations: this.stats.invalidations,
        issues: {
          total: this.issues.length,
          byType: issuesByType,
          bySeverity: issuesBySeverity
        }
      },
      timeline: this.timeline,
      cacheState: this.cacheEngine.getCacheState(),
      entityDependencyMap: this.cacheEngine.getEntityDependencyMap(),
      recommendations
    };
  }

  private processQuery(operation: GraphQLOperation): void {
    this.stats.totalQueries++;
    
    const cacheKey = this.parser.generateCacheKey(
      operation.operationName,
      operation.query,
      operation.variables
    );

    const entityKeys = this.parser.extractEntityKeysFromResult(
      operation.result,
      operation.operationName
    );

    const entityKeyStrings = entityKeys.map(ek => ek.key);

    this.detectMissingKeys(entityKeyStrings, operation);

    const { entry, isHit, isStale } = this.cacheEngine.get(cacheKey, operation.timestamp);

    const eventIssues: Issue[] = [];

    if (isStale) {
      const staleIssue = this.addIssue({
        type: 'stale_data',
        severity: 'high',
        timestamp: operation.timestamp,
        operationName: operation.operationName,
        message: `Stale data detected for ${operation.operationName} - TTL expired but data would have been served`,
        details: {
          cacheKey,
          expiredAt: entry?.expiresAt,
          currentTime: operation.timestamp,
          entityKeys: entityKeyStrings
        }
      });
      eventIssues.push(staleIssue);
    }

    if (isHit) {
      this.stats.cacheHits++;
      
      const timelineEvent: TimelineEvent = {
        timestamp: operation.timestamp,
        type: 'query',
        operationName: operation.operationName,
        details: {
          cacheHit: true
        },
        issues: eventIssues
      };
      
      this.timeline.push(timelineEvent);
    } else {
      this.stats.cacheMisses++;
      
      const missIssue = this.addIssue({
        type: 'cache_miss',
        severity: 'low',
        timestamp: operation.timestamp,
        operationName: operation.operationName,
        message: `Cache miss for ${operation.operationName}`,
        details: {
          cacheKey,
          entityKeys: entityKeyStrings,
          variables: operation.variables
        }
      });
      eventIssues.push(missIssue);

      this.cacheEngine.set(
        cacheKey,
        operation.operationName,
        entityKeyStrings,
        operation.result,
        operation.query,
        operation.variables,
        operation.timestamp
      );

      const timelineEvent: TimelineEvent = {
        timestamp: operation.timestamp,
        type: 'query',
        operationName: operation.operationName,
        details: {
          cacheHit: false
        },
        issues: eventIssues
      };
      
      this.timeline.push(timelineEvent);
    }
  }

  private processMutation(mutation: MutationEvent): void {
    this.stats.totalMutations++;

    const affectedKeys = mutation.affectedEntities.map(
      ae => `${ae.entityType}:${ae.entityId}`
    );

    const affectedEntityTypes = [...new Set(mutation.affectedEntities.map(ae => ae.entityType))];

    const invalidatedByEntity = this.cacheEngine.invalidateByEntityKeys(
      affectedKeys,
      mutation.timestamp
    );

    const invalidatedByTags = this.cacheEngine.invalidateByTagRules(
      affectedEntityTypes,
      mutation.timestamp
    );

    const allInvalidatedKeys = [...new Set([...invalidatedByEntity, ...invalidatedByTags])];
    this.stats.invalidations += allInvalidatedKeys.length;

    const eventIssues: Issue[] = [];

    if (allInvalidatedKeys.length > 0) {
      const overInvalidation = this.detectOverInvalidation(
        allInvalidatedKeys,
        affectedKeys,
        mutation
      );
      
      if (overInvalidation) {
        eventIssues.push(overInvalidation);
      }
    }

    const timelineEvent: TimelineEvent = {
      timestamp: mutation.timestamp,
      type: 'mutation',
      operationName: mutation.operationName,
      details: {
        affectedKeys,
        evictedKeys: allInvalidatedKeys
      },
      issues: eventIssues
    };
    
    this.timeline.push(timelineEvent);

    if (allInvalidatedKeys.length > 0) {
      const invalidationEvent: TimelineEvent = {
        timestamp: mutation.timestamp,
        type: 'invalidation',
        operationName: 'CacheInvalidation',
        details: {
          evictedKeys: allInvalidatedKeys
        },
        issues: []
      };
      this.timeline.push(invalidationEvent);
    }
  }

  private checkOutOfOrderMutations(): void {
    const mutations = this.events
      .filter(e => e.type === 'mutation')
      .map(e => e.originalEvent as MutationEvent)
      .sort((a, b) => a.timestamp - b.timestamp);

    const entityMutations = new Map<string, MutationEvent[]>();
    
    for (const mutation of mutations) {
      for (const affected of mutation.affectedEntities) {
        const entityKey = `${affected.entityType}:${affected.entityId}`;
        const existing = entityMutations.get(entityKey) || [];
        existing.push(mutation);
        entityMutations.set(entityKey, existing);
      }
    }

    for (const [entityKey, entityMutList] of entityMutations) {
      if (entityMutList.length < 2) continue;

      for (let i = 0; i < entityMutList.length - 1; i++) {
        const current = entityMutList[i];
        const next = entityMutList[i + 1];

        if (current.timestamp === next.timestamp) {
          this.addIssue({
            type: 'out_of_order_mutation',
            severity: 'high',
            timestamp: current.timestamp,
            operationName: current.operationName,
            message: `Out-of-order mutations detected for entity ${entityKey} - same timestamp`,
            details: {
              entityKey,
              mutation1: {
                operationName: current.operationName,
                action: current.affectedEntities.find(ae => 
                  `${ae.entityType}:${ae.entityId}` === entityKey
                )?.action
              },
              mutation2: {
                operationName: next.operationName,
                action: next.affectedEntities.find(ae => 
                  `${ae.entityType}:${ae.entityId}` === entityKey
                )?.action
              },
              timestamp: current.timestamp
            }
          });
        }
      }
    }
  }

  private detectMissingKeys(
    entityKeys: string[],
    operation: GraphQLOperation
  ): void {
    if (entityKeys.length === 0 && operation.result) {
      this.addIssue({
        type: 'missing_key',
        severity: 'medium',
        timestamp: operation.timestamp,
        operationName: operation.operationName,
        message: `No entity keys extracted from result for ${operation.operationName}`,
        details: {
          operationName: operation.operationName,
          variables: operation.variables,
          resultKeys: operation.result?.data ? Object.keys(operation.result.data) : []
        }
      });
    }
  }

  private detectOverInvalidation(
    invalidatedKeys: string[],
    affectedKeys: string[],
    mutation: MutationEvent
  ): Issue | null {
    const directlyAffected = invalidatedKeys.filter(key => {
      const entry = this.cacheEngine.getCacheState()[key];
      if (!entry) return false;
      return entry.entityKeys.some(ek => affectedKeys.includes(ek));
    });

    const indirectlyAffected = invalidatedKeys.length - directlyAffected.length;

    if (indirectlyAffected > 0 && directlyAffected.length === 0) {
      return this.addIssue({
        type: 'over_invalidation',
        severity: 'medium',
        timestamp: mutation.timestamp,
        operationName: mutation.operationName,
        message: `Over-invalidation detected: ${indirectlyAffected} cache entries invalidated by tag rules but no direct entity match`,
        details: {
          mutation: mutation.operationName,
          affectedKeys,
          invalidatedKeys,
          directlyAffected,
          indirectlyAffected
        }
      });
    }

    return null;
  }

  private groupIssuesByType(): Record<IssueType, number> {
    const result: Record<string, number> = {};
    for (const issue of this.issues) {
      result[issue.type] = (result[issue.type] || 0) + 1;
    }
    return result as Record<IssueType, number>;
  }

  private groupIssuesBySeverity(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const issue of this.issues) {
      result[issue.severity] = (result[issue.severity] || 0) + 1;
    }
    return result;
  }

  private generateRecommendations(cacheHitRate: number): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const issuesByType = this.groupIssuesByType();
    let recCounter = 0;

    if (issuesByType['stale_data'] > 0) {
      recommendations.push({
        id: `rec-${++recCounter}`,
        type: 'ttl',
        priority: 'high',
        title: 'Adjust TTL values to prevent stale data',
        description: 'Stale data issues detected. Consider increasing TTL for frequently accessed data or implementing more precise invalidation strategies.',
        affectedOperations: this.issues
          .filter(i => i.type === 'stale_data')
          .map(i => i.operationName)
      });
    }

    if (issuesByType['over_invalidation'] > 0) {
      recommendations.push({
        id: `rec-${++recCounter}`,
        type: 'invalidation',
        priority: 'medium',
        title: 'Review tag-based invalidation rules',
        description: 'Over-invalidation detected. Consider making tag rules more specific or using entity-based invalidation instead of broad tag invalidation.',
        affectedOperations: this.issues
          .filter(i => i.type === 'over_invalidation')
          .map(i => i.operationName)
      });
    }

    if (issuesByType['missing_key'] > 0) {
      recommendations.push({
        id: `rec-${++recCounter}`,
        type: 'policy',
        priority: 'high',
        title: 'Configure entity key fields properly',
        description: 'Missing entity keys detected. Ensure all entity types have proper keyFields configured in cache policy, and that results include identifier fields.',
        affectedOperations: this.issues
          .filter(i => i.type === 'missing_key')
          .map(i => i.operationName)
      });
    }

    if (issuesByType['out_of_order_mutation'] > 0) {
      recommendations.push({
        id: `rec-${++recCounter}`,
        type: 'policy',
        priority: 'high',
        title: 'Handle concurrent mutations properly',
        description: 'Out-of-order mutations detected at same timestamp. Consider using versioning or transactional updates to ensure correct ordering.',
        affectedOperations: this.issues
          .filter(i => i.type === 'out_of_order_mutation')
          .map(i => i.operationName)
      });
    }

    if (issuesByType['circular_dependency'] > 0) {
      recommendations.push({
        id: `rec-${++recCounter}`,
        type: 'dependency',
        priority: 'high',
        title: 'Resolve circular dependencies in entity policy',
        description: 'Circular dependencies detected. This can cause infinite invalidation loops. Review and fix entity dependencies.',
        affectedOperations: ['PolicyValidation']
      });
    }

    if (cacheHitRate < 0.5 && this.stats.totalQueries > 10) {
      recommendations.push({
        id: `rec-${++recCounter}`,
        type: 'policy',
        priority: 'medium',
        title: 'Improve cache hit rate',
        description: `Cache hit rate is ${(cacheHitRate * 100).toFixed(1)}%. Consider increasing TTL, improving key matching, or pre-filling cache.`,
        affectedOperations: []
      });
    }

    return recommendations;
  }

  private addIssue(issue: Omit<Issue, 'id'>): Issue {
    const newIssue = {
      ...issue,
      id: `issue-${++this.issueCounter}`
    };
    this.issues.push(newIssue);
    return newIssue;
  }
}
